// Shared helpers for the growth CLI scripts. Plain ESM, no new dependencies —
// run with Node's built-in env loader:
//   node --env-file=.env.local scripts/<script>.mjs ...
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";

export function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(
      `✗ missing env ${name}. Run with:  node --env-file=.env.local scripts/<script>.mjs ...`,
    );
    process.exit(1);
  }
  return v;
}

export function getSupabase() {
  return createClient(
    need("NEXT_PUBLIC_SUPABASE_URL"),
    need("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

const SECRET = () => process.env.JUSTCOFFEE_SESSION_SECRET || "jc-growth-fallback";

export function slug(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Deterministic, un-guessable contact id (used as ?ct=). Stable for the same
 *  email+market across runs, so repeat sends reuse one identity. */
export function contactId(email, market) {
  const h = createHmac("sha256", SECRET())
    .update("contact:" + String(email).trim().toLowerCase() + "|" + slug(market))
    .digest("hex")
    .slice(0, 16);
  return "c-" + h;
}

/** Must match verifyUnsubToken() in lib/growth.ts. */
export function unsubToken(id) {
  return createHmac("sha256", SECRET())
    .update("unsub:" + id)
    .digest("hex")
    .slice(0, 32);
}

export function emailHash(email) {
  return createHmac("sha256", SECRET())
    .update(String(email).trim().toLowerCase())
    .digest("hex");
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (s) => EMAIL_RE.test(String(s ?? "").trim());

// Minimal RFC-4180-ish CSV parser (handles quotes, escaped quotes, CRLF).
export function parseCsv(text) {
  const rows = [];
  let row = [],
    field = "",
    inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

/** Turn CSV text into [{email, name, market}]. Accepts a header row
 *  (email/name/market columns) or a bare list where the email is any column. */
export function readContacts(text, fallbackMarket = "") {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  let header = null,
    start = 0;
  if (!rows[0].some(isEmail)) {
    header = rows[0].map((s) => s.trim().toLowerCase());
    start = 1;
  }
  const col = (names) => (header ? header.findIndex((h) => names.includes(h)) : -1);
  const ei = col(["email", "e-mail", "email_address", "emails"]);
  const ni = col(["name", "first_name", "firstname", "first name"]);
  const mi = col(["market", "campus", "segment", "school"]);
  const out = [];
  const seen = new Set();
  for (let r = start; r < rows.length; r++) {
    const cells = rows[r];
    let email = header && ei >= 0 ? cells[ei] : cells.find(isEmail) ?? cells[0];
    email = String(email ?? "").trim().toLowerCase();
    if (!isEmail(email) || seen.has(email)) continue;
    seen.add(email);
    const name = header && ni >= 0 ? String(cells[ni] ?? "").trim() : "";
    const market = slug(header && mi >= 0 && cells[mi] ? cells[mi] : fallbackMarket);
    out.push({ email, name, market });
  }
  return out;
}

export function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Tiny --flag / --key=value reader. */
export function arg(name, def = undefined) {
  const pre = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(pre));
  if (hit) return hit.slice(pre.length);
  if (process.argv.includes(`--${name}`)) return true;
  return def;
}
