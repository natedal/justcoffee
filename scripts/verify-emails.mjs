// Verify a CSV of emails BEFORE you send — so you don't blast dead addresses and
// wreck your sender reputation (a high bounce rate gets a new domain throttled
// fast). Writes a cleaned CSV you can feed straight to send-campaign.mjs.
//
//   node --env-file=.env.local scripts/verify-emails.mjs --csv=list.csv \
//        [--out=list.verified.csv] [--smtp] [--keep-risky]
//
// Checks, cheapest first:
//   • syntax + de-dup            (free, reliable — handled by readContacts)
//   • domain MX records          (free, reliable — catches dead/typo'd domains)
//   • role accounts & disposable (free — flags info@, mailinator.com, …)
//   • SMTP mailbox probe          (--smtp; best-effort, needs outbound port 25,
//                                  which many ISPs/clouds block → returns "unknown")
//
// MX checks catch dead *domains*. For dead *mailboxes* on live domains (the usual
// case with sourced .edu lists, where the domain is valid but the student
// graduated) use --smtp where port 25 is open, or wire a verification API into
// verifyMailbox() below (NeverBounce / ZeroBounce / Kickbox / Bouncer / …).

import { readFileSync, writeFileSync } from "node:fs";
import { resolveMx } from "node:dns/promises";
import net from "node:net";
import { readContacts, slug, arg } from "./_growth.mjs";

const csvPath = arg("csv");
if (!csvPath) {
  console.error(
    "usage: node --env-file=.env.local scripts/verify-emails.mjs --csv=list.csv [--out=clean.csv] [--smtp] [--keep-risky]",
  );
  process.exit(1);
}
const outPath = arg("out") || csvPath.replace(/\.csv$/i, "") + ".verified.csv";
const doSmtp = arg("smtp", false) === true;
const keepRisky = arg("keep-risky", false) === true;

const ROLE = new Set([
  "admin", "administrator", "info", "support", "sales", "contact", "help",
  "hello", "team", "office", "billing", "careers", "jobs", "hr", "marketing",
  "noreply", "no-reply", "donotreply", "postmaster", "webmaster", "abuse",
  "root", "mailer-daemon",
]);
const DISPOSABLE = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
  "yopmail.com", "trashmail.com", "getnada.com", "sharklasers.com",
]);

const PROBE_DOMAIN =
  ((process.env.CAMPAIGN_EMAIL_FROM || "").split("@")[1] || "")
    .replace(/>.*$/, "")
    .trim() || "example.com";

const contacts = readContacts(readFileSync(csvPath, "utf8"), slug(arg("market", "")));
if (!contacts.length) {
  console.error(`No valid-syntax emails found in ${csvPath}.`);
  process.exit(1);
}

const mxCache = new Map();
async function lookupMx(domain) {
  if (mxCache.has(domain)) return mxCache.get(domain);
  let v = { ok: false, host: "" };
  try {
    const recs = await resolveMx(domain);
    if (recs && recs.length) {
      v = { ok: true, host: recs.sort((a, b) => a.priority - b.priority)[0].exchange };
    }
  } catch {
    /* no MX / NXDOMAIN → can't receive mail */
  }
  mxCache.set(domain, v);
  return v;
}

// Best-effort SMTP RCPT probe: does the mailbox accept mail? Never sends DATA.
async function smtpProbe(email, mxHost) {
  return new Promise((resolve) => {
    let stage = 0;
    let result = "unknown";
    const sock = net.createConnection(25, mxHost);
    sock.setTimeout(8000);
    const w = (s) => sock.write(s + "\r\n");
    sock.on("data", (b) => {
      const code = parseInt(b.toString().slice(0, 3), 10);
      if (stage === 0 && code === 220) { w("EHLO justcoffee.app"); stage = 1; }
      else if (stage === 1 && code === 250) { w(`MAIL FROM:<verify@${PROBE_DOMAIN}>`); stage = 2; }
      else if (stage === 2 && code === 250) { w(`RCPT TO:<${email}>`); stage = 3; }
      else if (stage === 3) {
        result = code === 250 || code === 251 ? "valid" : code >= 500 ? "invalid" : "unknown";
        w("QUIT");
        sock.end();
      }
    });
    sock.on("timeout", () => sock.destroy());
    sock.on("error", () => {});
    sock.on("close", () => resolve(result));
  });
}

// --- ZeroBounce mailbox verification (optional; set ZEROBOUNCE_API_KEY) --------
const ZB_KEY = process.env.ZEROBOUNCE_API_KEY || "";
let zbDisabled = !ZB_KEY;
const ZB_MAP = {
  valid: "valid",
  invalid: "invalid",
  "catch-all": "risky",
  unknown: "unknown",
  spamtrap: "invalid",
  abuse: "invalid",
  do_not_mail: "invalid",
};

async function zbCredits() {
  try {
    const r = await fetch(`https://api.zerobounce.net/v2/getcredits?api_key=${ZB_KEY}`);
    return Number((await r.json()).Credits);
  } catch {
    return -1;
  }
}

/** Mailbox-level check via ZeroBounce. Returns a status, or null to fall back to
 *  the MX/role result — e.g. when the key is unset OR credits run out, per the
 *  "if I run out of credits, just don't use it" requirement. */
async function verifyMailbox(email) {
  if (zbDisabled) return null;
  try {
    const r = await fetch(
      `https://api.zerobounce.net/v2/validate?api_key=${ZB_KEY}&email=${encodeURIComponent(email)}&ip_address=`,
    );
    const j = await r.json();
    if (j.error) {
      console.warn(`\n⚠ ZeroBounce off (${j.error}) — falling back to MX-only for the rest.`);
      zbDisabled = true; // out of credits / bad key: stop calling it
      return null;
    }
    return ZB_MAP[j.status] ?? "unknown";
  } catch {
    return null; // transient network issue — don't block
  }
}

async function classify(c) {
  const [local, domain] = c.email.split("@");
  if (DISPOSABLE.has(domain.toLowerCase())) return "invalid";
  const mx = await lookupMx(domain.toLowerCase());
  if (!mx.ok) return "invalid"; // domain can't receive mail
  const api = await verifyMailbox(c.email);
  if (api) return api;
  let status = ROLE.has(local.toLowerCase()) ? "risky" : "valid";
  if (doSmtp) {
    const probe = await smtpProbe(c.email, mx.host);
    if (probe === "invalid") status = "invalid";
    else if (probe === "unknown" && status === "valid") status = "risky";
  }
  return status;
}

if (ZB_KEY) {
  const credits = await zbCredits();
  if (credits <= 0) {
    console.warn(`⚠ ZeroBounce: ${credits < 0 ? "couldn't reach API" : "0 credits"} — using MX-only.`);
    zbDisabled = true;
  } else {
    console.log(`ZeroBounce: ${credits.toLocaleString()} credits available.`);
  }
}

const counts = { valid: 0, risky: 0, invalid: 0 };
const keep = [];
const POOL = doSmtp ? 5 : !zbDisabled ? 10 : 20; // gentler concurrency when calling an API
for (let i = 0; i < contacts.length; i += POOL) {
  const batch = contacts.slice(i, i + POOL);
  const res = await Promise.all(batch.map(async (c) => ({ c, status: await classify(c) })));
  for (const { c, status } of res) {
    counts[status]++;
    if (status === "valid" || (keepRisky && status === "risky")) keep.push(c);
  }
  process.stdout.write(`\rchecked ${Math.min(i + POOL, contacts.length)}/${contacts.length}…`);
}
process.stdout.write("\n");

const esc = (s) => (/[",\n]/.test(s) ? `"${String(s).replace(/"/g, '""')}"` : String(s));
const lines = ["email,name,market", ...keep.map((c) => [c.email, c.name, c.market].map(esc).join(","))];
writeFileSync(outPath, lines.join("\n") + "\n");

console.log(`\nverified ${contacts.length} addresses:`);
console.log(`  ✅ valid    ${counts.valid}`);
console.log(`  ⚠️  risky    ${counts.risky}  ${keepRisky ? "(kept)" : "(dropped — pass --keep-risky to keep)"}`);
console.log(`  ❌ invalid  ${counts.invalid}`);
console.log(`→ wrote ${keep.length} keeper(s) to ${outPath}`);
if (!doSmtp) {
  console.log(
    "note: domain-level (MX) check only. For mailbox-level validation on live domains\n" +
      "(e.g. .edu), re-run with --smtp (needs port 25) or wire verifyMailbox() to an API.",
  );
}
