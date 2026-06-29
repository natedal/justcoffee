// Editable email copy — one entry per ad variant. `research` is the default.
// Subjects must be honest and non-deceptive (CAN-SPAM). {name} and {market} are
// substituted; the renderer wraps each in the branded shell with the tracked CTA
// and the required unsubscribe + postal-address footer.
//
// To A/B test, give each ad its own key here and send with --variant=<key>; the
// dashboard compares them by signup rate.

export const VARIANTS = {
  research: {
    subject: "a two-minute coffee experiment in {market}",
    subjectPlain: "coffee with a stranger at {market}?",
    heading: "meet one person for coffee.",
    body: [
      "Hi{name} — we're a small team building justcoffee. You write one sentence about who you are and one about what you'd actually like to talk about, and we pair you with someone nearby who's up for the same conversation. No profiles to swipe, no “hey” into the void.",
      "We're inviting a few people to try it while we research what works. It's free, it's 18+, and setup takes about two minutes.",
    ],
    cta: "try justcoffee →",
    ps: "Feel free to reply to this email with feedback on the overall concept, or specific features you'd like to see.",
  },
  "hour-to-kill": {
    subject: "got an hour to kill?",
    heading: "have an hour to kill?",
    body: [
      "Meet someone nearby for a coffee and an actual conversation — paired by what you want to talk about, not by photos.",
    ],
    cta: "find someone →",
  },
  "not-a-date": {
    subject: "it's not a date. it's a coffee.",
    heading: "not a date. just coffee.",
    body: [
      "No swiping, no profiles, no pressure. One sentence about you, one about what you want to talk about, and we pair you with someone nearby.",
    ],
    cta: "try it →",
  },
  "two-sentences": {
    subject: "two sentences and you're in",
    heading: "two sentences. one coffee.",
    body: [
      "Tell us who you are and what you want to talk about — that's the whole profile. We introduce you to one person at a time.",
    ],
    cta: "write your two sentences →",
  },
  "across-the-table": {
    subject: "someone worth talking to is nearby",
    heading: "across the table, not across the app.",
    body: [
      "justcoffee gets you offline and into a real conversation with someone nearby who wants to talk about the same thing you do.",
    ],
    cta: "meet someone →",
  },
  "bubble-slider": {
    subject: "someone like you — or not",
    heading: "set the dial. meet your match.",
    body: [
      "Slide from “someone like me” to “someone I'd never normally meet,” and we pair you accordingly — always with a shared reason to talk.",
    ],
    cta: "set your dial →",
  },
  "campus-flyer": {
    subject: "the coffee thing going around {market}",
    heading: "you've seen the flyers. here's the app.",
    body: [
      "Meet one nearby person for a coffee and a real conversation. Free, 18+, two minutes to set up.",
    ],
    cta: "claim your coffee →",
  },
};

// Friendly display labels per market slug. The slug stays the tracking key (in
// links + the dashboard); the label is what recipients actually read in the copy.
export const MARKET_LABELS = {
  uic: "UIC",
  "u-illinois": "the University of Illinois",
  uiuc: "UIUC",
  "ut-austin": "UT Austin",
  nyu: "NYU",
};

export function marketLabel(slug) {
  return slug ? MARKET_LABELS[slug] || slug : "your area";
}

// Pull a clean first name out of messy list data like "Bargi, Raymond (UIC)".
export function firstName(name) {
  if (!name) return "";
  let n = String(name).replace(/\(.*?\)/g, " ").trim(); // drop "(UIC)" annotations
  if (n.includes(",")) n = n.split(",")[1] || ""; // "Last, First" -> "First"
  return (n.trim().split(/\s+/)[0] || "").trim(); // first token only
}

const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const fill = (s, name, market) =>
  String(s)
    .replaceAll("{name}", name ? ` ${name}` : "")
    .replaceAll("{market}", market || "your area");

export function renderEmail({
  variant,
  name,
  market,
  ctaUrl,
  unsubUrl,
  postalAddress,
  plain = false,
}) {
  const v = VARIANTS[variant] || VARIANTS.research;
  // Show a friendly label (e.g. "UIC") in the copy; the tracking slug lives in
  // the links passed in as ctaUrl/unsubUrl, so attribution is unaffected.
  market = marketLabel(market);
  name = firstName(name); // "Bargi, Raymond (UIC)" -> "Raymond"
  const subject = fill(
    plain && v.subjectPlain ? v.subjectPlain : v.subject,
    name,
    market,
  );
  const heading = fill(v.heading, name, market);
  const paras = v.body
    .map(
      (b) =>
        `<p style="margin:0 0 16px;line-height:1.55">${esc(fill(b, name, market))}</p>`,
    )
    .join("");

  // Plain, personal-looking variant — no logo or button, a plain inline link,
  // signed by a person. Reads as a 1:1 note, which lands in Primary more often
  // (and tends to get more replies) than the designed/marketing layout.
  if (plain) {
    const pb = v.body
      .map((b) => `<p style="margin:0 0 14px">${esc(fill(b, name, market))}</p>`)
      .join("");
    const plainHtml = `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#222;max-width:520px">
    ${pb}
    <p style="margin:0 0 14px">If you want to give it a try, it's here: <a href="${ctaUrl}" style="color:#15625C">justcoffee.app</a></p>
    ${v.ps ? `<p style="margin:0 0 14px">${esc(fill(v.ps, name, market))}</p>` : ""}
    <p style="margin:0 0 14px">— Nate</p>
    <p style="margin:22px 0 0;font-size:12px;color:#999">${postalAddress ? esc(postalAddress) + " · " : ""}<a href="${unsubUrl}" style="color:#999">unsubscribe</a></p>
  </div>`;
    const plainText =
      v.body.map((b) => fill(b, name, market)).join("\n\n") +
      `\n\nIf you want to give it a try, it's here: ${ctaUrl}` +
      (v.ps ? `\n\n${fill(v.ps, name, market)}` : "") +
      `\n\n— Nate\n\n` +
      (postalAddress ? postalAddress + " · " : "") +
      `unsubscribe: ${unsubUrl}`;
    return { subject, html: plainHtml, text: plainText };
  }

  const html = `<!doctype html><html><body style="margin:0;background:#F0E7D5">
  <div style="font-family:Helvetica Neue,Helvetica,Arial,sans-serif;max-width:520px;margin:0 auto;padding:40px 24px;color:#281A12">
    <p style="font-size:26px;font-weight:700;margin:0 0 4px">justcoffee</p>
    <p style="color:#6b5a4e;margin:0 0 26px;font-style:italic">${esc(heading)}</p>
    ${paras}
    <a href="${ctaUrl}" style="display:inline-block;background:#15625C;color:#F0E7D5;text-decoration:none;font-weight:700;padding:14px 28px;border-radius:999px;font-size:16px;margin:6px 0 4px">${esc(v.cta)}</a>
    ${v.ps ? `<p style="margin:24px 0 0;line-height:1.55">${esc(fill(v.ps, name, market))}</p>` : ""}
    <p style="margin:28px 0 0;font-size:12px;color:#9b8b7e;line-height:1.6">
      You're getting this because we're researching justcoffee in ${esc(market || "your area")}.<br>
      ${postalAddress ? esc(postalAddress) + "<br>" : ""}
      <a href="${unsubUrl}" style="color:#9b8b7e">Unsubscribe</a> — one click, no questions.
    </p>
  </div></body></html>`;

  const text =
    `${heading}\n\n` +
    v.body.map((b) => fill(b, name, market)).join("\n\n") +
    `\n\n${v.cta}  ${ctaUrl}\n\n` +
    (v.ps ? fill(v.ps, name, market) + "\n\n" : "") +
    `—\n` +
    `You're getting this because we're researching justcoffee in ${market || "your area"}.\n` +
    (postalAddress ? postalAddress + "\n" : "") +
    `Unsubscribe: ${unsubUrl}`;

  return { subject, html, text };
}
