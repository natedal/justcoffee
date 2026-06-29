// Send a research email to a CSV list — tracked, CAN-SPAM compliant, dry-run by
// default. Each recipient gets a unique CTA link (?v&c&ch=email&ct) so clicks and
// signups attribute back to this ad on the /growth dashboard.
//
//   # 1) preview (no emails sent, nothing written):
//   node --env-file=.env.local scripts/send-campaign.mjs \
//        --csv=lists/ut-austin.csv --variant=research --market=ut-austin
//
//   # 2) actually send (after setting CAMPAIGN_EMAIL_FROM + CAMPAIGN_POSTAL_ADDRESS):
//   node --env-file=.env.local scripts/send-campaign.mjs \
//        --csv=lists/ut-austin.csv --variant=research --market=ut-austin --send
//
// Flags: --variant (ad key in emails.mjs, default research) --market --csv
//        --limit=N (cap recipients) --subject="..." --from="..." --send
import { readFileSync } from "node:fs";
import {
  getSupabase,
  readContacts,
  contactId,
  unsubToken,
  emailHash,
  slug,
  chunk,
  sleep,
  arg,
  need,
} from "./_growth.mjs";
import { renderEmail, VARIANTS } from "./emails.mjs";

const variant = slug(arg("variant", "research"));
const market = slug(arg("market", ""));
const forceMarket = arg("force-market", false) === true; // --market overrides the CSV column
const bare = arg("bare", false) === true; // text-only + no List-Unsubscribe header (max Primary)
const plainMode = arg("plain", false) === true || bare; // personal, minimal-HTML rendering
const csvPath = arg("csv");
const doSend = arg("send", false) === true;
const limit = Number(arg("limit", "0")) || 0;
const subjectOverride = arg("subject");
const from = arg("from") || process.env.CAMPAIGN_EMAIL_FROM || "";
const replyTo = arg("reply-to") || process.env.CAMPAIGN_REPLY_TO || "";

if (!csvPath) {
  console.error(
    "usage: node --env-file=.env.local scripts/send-campaign.mjs --csv=list.csv --variant=research --market=ut-austin [--limit=50] [--send]",
  );
  process.exit(1);
}
if (!VARIANTS[variant]) {
  console.warn(
    `⚠ no copy for variant "${variant}" in scripts/emails.mjs — falling back to "research".`,
  );
}

const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://justcoffee.app").replace(
  /\/$/,
  "",
);
const postalAddress = process.env.CAMPAIGN_POSTAL_ADDRESS || "";
const fromDomain = (from.split("@").pop() || "")
  .replace(/>.*$/, "")
  .trim()
  .toLowerCase();
const authDomain = ((process.env.JUSTCOFFEE_EMAIL_FROM || "").split("@").pop() || "")
  .replace(/>.*$/, "")
  .trim()
  .toLowerCase();

let contacts = readContacts(readFileSync(csvPath, "utf8"), market);
if (limit > 0) contacts = contacts.slice(0, limit);
if (!contacts.length) {
  console.error(`No valid emails found in ${csvPath}.`);
  process.exit(1);
}

const recipients = contacts.map((c) => {
  const mk = forceMarket ? market : c.market || market;
  const id = contactId(c.email, mk);
  return {
    ...c,
    market: mk,
    id,
    cta: `${appUrl}/?v=${encodeURIComponent(variant)}&c=${encodeURIComponent(mk)}&ch=email&ct=${id}`,
    unsub: `${appUrl}/api/growth/unsubscribe?ct=${id}&sig=${unsubToken(id)}`,
  };
});

// Honor the suppression list.
const sb = getSupabase();
const suppressed = new Set();
for (const part of chunk(recipients.map((r) => r.email), 500)) {
  const { data } = await sb
    .from("growth_unsubscribes")
    .select("email")
    .in("email", part);
  for (const r of data ?? []) suppressed.add(r.email);
}
const sendable = recipients.filter((r) => !suppressed.has(r.email));

// --- preview --------------------------------------------------------------
console.log(`campaign:   variant=${variant}  market=${market || "(per-row)"}  channel=email`);
console.log(`from:       ${from || "(CAMPAIGN_EMAIL_FROM unset)"}`);
if (replyTo) console.log(`reply-to:   ${replyTo}`);
console.log(
  `recipients: ${recipients.length} in CSV · ${suppressed.size} unsubscribed · ${sendable.length} will send`,
);
const sample = sendable[0];
if (sample) {
  const m = renderEmail({
    variant,
    name: sample.name,
    market: sample.market,
    ctaUrl: sample.cta,
    unsubUrl: sample.unsub,
    postalAddress,
    plain: plainMode,
  });
  console.log(`\nsample to:      ${sample.email}`);
  console.log(`sample subject: ${subjectOverride || m.subject}`);
  console.log(`sample CTA:     ${sample.cta}`);
  console.log(`sample unsub:   ${sample.unsub}`);
}

if (!doSend) {
  console.log("\n— DRY RUN — no emails sent, nothing written. Add --send to transmit.");
  process.exit(0);
}

// --- guardrails before a real send ---------------------------------------
if (!from) {
  console.error(
    "\n✗ Set CAMPAIGN_EMAIL_FROM (e.g. 'justcoffee research <research@go.justcoffee.app>') or pass --from.",
  );
  process.exit(1);
}
if (!postalAddress) {
  console.error(
    "\n✗ Set CAMPAIGN_POSTAL_ADDRESS — CAN-SPAM requires a physical mailing address in every email.",
  );
  process.exit(1);
}
if (authDomain && fromDomain === authDomain) {
  console.warn(
    `\n⚠ Your campaign From domain matches your magic-link auth domain (${authDomain}).`,
  );
  console.warn(
    "  Cold-email bounces/complaints can degrade sign-in deliverability. A separate subdomain is strongly recommended.",
  );
  console.warn("  Continuing in 5s… (Ctrl-C to abort)");
  await sleep(5000);
}
if (!sendable.length) {
  console.log("\nNothing to send (all recipients suppressed).");
  process.exit(0);
}

const { Resend } = await import("resend");
const resend = new Resend(need("RESEND_API_KEY"));

let sent = 0,
  failed = 0;
const now = Date.now();
for (const batch of chunk(sendable, 100)) {
  const payload = batch.map((r) => {
    const m = renderEmail({
      variant,
      name: r.name,
      market: r.market,
      ctaUrl: r.cta,
      unsubUrl: r.unsub,
      postalAddress,
      plain: plainMode,
    });
    return {
      from,
      replyTo: replyTo || undefined,
      to: r.email,
      subject: subjectOverride || m.subject,
      html: bare ? undefined : m.html,
      text: m.text,
      headers: bare
        ? undefined
        : {
            "List-Unsubscribe": `<${r.unsub}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
      tags: [
        { name: "variant", value: variant },
        { name: "market", value: r.market || "none" },
        { name: "contact", value: r.id },
      ],
    };
  });

  let res;
  try {
    res = await resend.batch.send(payload);
  } catch (e) {
    console.error("batch error:", e?.message || e);
    failed += batch.length;
    continue;
  }
  if (res?.error) {
    console.error("batch error:", res.error.message);
    failed += batch.length;
    continue;
  }

  const ids = res?.data?.data ?? [];
  // Remember who we mailed, and log a `sent` event per recipient.
  await sb.from("growth_contacts").upsert(
    batch.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      market: r.market,
      source: "send",
      created_at: now,
    })),
    { onConflict: "id" },
  );
  await sb.from("growth_events").insert(
    batch.map((r, i) => ({
      type: "sent",
      variant,
      market: r.market,
      channel: "email",
      contact_id: r.id,
      email_hash: emailHash(r.email),
      meta: { resend_id: ids[i]?.id ?? null },
      at: Date.now(),
    })),
  );

  sent += batch.length;
  console.log(`  sent ${sent}/${sendable.length}…`);
  await sleep(600); // gentle on rate limits
}

console.log(
  `\n✓ done. sent ${sent}, failed ${failed}. Watch /growth — email clicks land as visits (channel=email) → signups.`,
);
