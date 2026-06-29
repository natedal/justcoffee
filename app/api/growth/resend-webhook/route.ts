import crypto from "node:crypto";
import { logEvent } from "@/lib/growth";
import type { GrowthEventType } from "@/lib/growth-shared";

// Resend webhook -> growth_events. Folds email-level engagement (delivered, open,
// click, bounce, complaint) into the same funnel as on-site visits and signups,
// correlated by the variant/market/contact tags we set when sending.
//
// Resend signs webhooks with Svix. We verify the signature with node:crypto so
// no `svix` dependency is needed. Set RESEND_WEBHOOK_SECRET to the signing secret
// (starts with `whsec_`) from the Resend dashboard.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifySvix(
  secret: string,
  id: string,
  ts: string,
  body: string,
  sigHeader: string,
): boolean {
  if (!secret || !id || !ts || !sigHeader) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${ts}.${body}`)
    .digest("base64");
  // Header is space-separated "v1,<sig>" tokens; any match is valid.
  for (const part of sigHeader.split(" ")) {
    const sig = part.split(",")[1] ?? "";
    try {
      if (sig && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected)))
        return true;
    } catch {
      /* length mismatch — not this one */
    }
  }
  return false;
}

const TYPE_MAP: Record<string, GrowthEventType> = {
  "email.sent": "sent",
  "email.delivered": "delivered",
  "email.opened": "opened",
  "email.clicked": "clicked",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

function tagsToObj(tags: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(tags)) {
    for (const t of tags) {
      if (t && typeof t === "object" && "name" in t) {
        const name = String((t as { name: unknown }).name);
        const value =
          "value" in t ? String((t as { value: unknown }).value ?? "") : "";
        out[name] = value;
      }
    }
  } else if (tags && typeof tags === "object") {
    for (const [k, v] of Object.entries(tags as Record<string, unknown>))
      out[k] = String(v ?? "");
  }
  return out;
}

export async function POST(req: Request) {
  const body = await req.text(); // raw body required for signature verification
  const ok = verifySvix(
    process.env.RESEND_WEBHOOK_SECRET ?? "",
    req.headers.get("svix-id") ?? "",
    req.headers.get("svix-timestamp") ?? "",
    body,
    req.headers.get("svix-signature") ?? "",
  );
  if (!ok) return new Response("invalid signature", { status: 401 });

  let evt: { type?: string; data?: Record<string, unknown> };
  try {
    evt = JSON.parse(body);
  } catch {
    return new Response("bad json", { status: 400 });
  }

  const type = evt.type ? TYPE_MAP[evt.type] : undefined;
  if (!type) return new Response("ignored", { status: 200 });

  const data = (evt.data ?? {}) as Record<string, unknown>;
  const tags = tagsToObj(data.tags);
  const toRaw = data.to;
  const to = Array.isArray(toRaw)
    ? String(toRaw[0] ?? "")
    : typeof toRaw === "string"
      ? toRaw
      : "";
  const click = data.click as { link?: string } | undefined;

  await logEvent({
    type,
    attr: {
      v: tags.variant ?? "",
      c: tags.market ?? "",
      ch: "email",
      ct: tags.contact ?? "",
    },
    email: to || null,
    meta: {
      resend_id: (data.email_id as string) ?? null,
      link: click?.link ?? null,
    },
  });

  return new Response("ok", { status: 200 });
}
