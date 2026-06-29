import { verifyUnsubToken, logEvent } from "@/lib/growth";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

// CAN-SPAM unsubscribe. Honors a signed token so bots can't opt out arbitrary
// contacts. Supports both a clicked link (GET -> confirmation page) and RFC 8058
// one-click (POST, via the List-Unsubscribe-Post header on the email).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function suppress(contactId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const sb = supabase();
  const { data } = await sb
    .from("growth_contacts")
    .select("email, market")
    .eq("id", contactId)
    .maybeSingle();
  const email = data?.email as string | undefined;
  if (!email) return false;
  await sb
    .from("growth_unsubscribes")
    .upsert({ email, at: Date.now() }, { onConflict: "email" });
  await sb.from("growth_contacts").update({ unsubscribed: true }).eq("email", email);
  await logEvent({
    type: "unsubscribed",
    attr: { v: "", c: (data?.market as string) ?? "", ch: "email", ct: contactId },
    email,
  });
  return true;
}

function page(msg: string) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;max-width:440px;margin:64px auto;padding:0 24px;color:#281A12;text-align:center">` +
      `<p style="font-size:24px;font-weight:700;margin:0 0 8px">justcoffee</p>` +
      `<p style="color:#6b5a4e;line-height:1.5">${msg}</p></div>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

function creds(req: Request) {
  const url = new URL(req.url);
  return {
    ct: url.searchParams.get("ct") ?? "",
    sig: url.searchParams.get("sig") ?? "",
  };
}

export async function GET(req: Request) {
  const { ct, sig } = creds(req);
  if (!ct || !verifyUnsubToken(ct, sig))
    return page("This unsubscribe link looks invalid. No changes were made.");
  await suppress(ct);
  return page(
    "You're unsubscribed — we won't email you about justcoffee research again.",
  );
}

export async function POST(req: Request) {
  const { ct, sig } = creds(req);
  if (!ct || !verifyUnsubToken(ct, sig))
    return new Response("invalid", { status: 400 });
  await suppress(ct);
  return new Response("unsubscribed", { status: 200 });
}
