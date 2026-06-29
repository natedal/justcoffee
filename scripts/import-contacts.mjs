// Import a CSV of contacts into growth_contacts (idempotent upsert).
//
//   node --env-file=.env.local scripts/import-contacts.mjs \
//        --csv=lists/ut-austin.csv --market=ut-austin [--source=apollo]
//
// CSV may have a header (email,name,market) or be a bare list of emails. A
// per-row `market` column wins; otherwise --market is used.
import { readFileSync } from "node:fs";
import { getSupabase, readContacts, contactId, slug, chunk, arg } from "./_growth.mjs";

const csvPath = arg("csv");
const market = slug(arg("market", ""));
const source = arg("source", "csv");

if (!csvPath) {
  console.error(
    "usage: node --env-file=.env.local scripts/import-contacts.mjs --csv=list.csv [--market=ut-austin] [--source=apollo]",
  );
  process.exit(1);
}

const contacts = readContacts(readFileSync(csvPath, "utf8"), market);
if (!contacts.length) {
  console.error(`No valid emails found in ${csvPath}.`);
  process.exit(1);
}

const now = Date.now();
const rows = contacts.map((c) => ({
  id: contactId(c.email, c.market || market),
  email: c.email,
  name: c.name,
  market: c.market || market,
  source,
  created_at: now,
}));

const sb = getSupabase();
let ok = 0;
for (const batch of chunk(rows, 500)) {
  const { error } = await sb
    .from("growth_contacts")
    .upsert(batch, { onConflict: "id" });
  if (error) {
    console.error("upsert error:", error.message);
    process.exit(1);
  }
  ok += batch.length;
}

console.log(
  `✓ imported/updated ${ok} contact(s)${market ? ` in market "${market}"` : ""}.`,
);
