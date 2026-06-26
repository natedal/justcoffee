# justcoffee

**have an hour to kill? meet a stranger for coffee.**

justcoffee pairs you with someone nearby who wants to talk about the same thing
you do — defined broadly, and matched by AI. You write one sentence about who you
are and one about what you want from a conversation, set a dial for how
*challenging* you want it to be, and get introduced to one person at a time. You
don't learn their name, see their photo, or message them until you **both** say
yes to coffee.

It borrows the best mechanics of a dating app — quick profiles, location-based
pairing, mutual opt-in reveal — and strips out the parts that make them
high-stakes. It's a utility for getting offline and into a real conversation.

> no profiles to swipe. no "hey" into the void. just talk. just coffee.

This repo is a working MVP of that product.

---

## Screens

| | | |
|---|---|---|
| ![landing](docs/screenshots/01-landing.png) | ![onboarding](docs/screenshots/02-onboarding.png) | ![find](docs/screenshots/03-find.png) |
| **Landing** | **Onboarding** — two sentences | **Find** — the challenge dial |
| ![card](docs/screenshots/04-match-card.png) | ![reveal](docs/screenshots/05-reveal.png) | ![chat](docs/screenshots/06-chat.png) |
| **Match card** — blurred, why-you-two | **Reveal** — both said yes | **Chat** — plan it + safety |

---

## The core loop

1. **Onboarding** — first name, age, an avatar, two sentences ("I'm a…" /
   "I'm looking to…"), when you're free, and where you are (city or device GPS).
2. **The challenge dial** — before each search, choose how far outside your bubble
   to go, from *"someone like me"* to *"someone I'd never normally meet."*
3. **Find someone** — the matcher returns one nearby person: a **blurred** avatar,
   a pseudonym, their two sentences, and a "why you two" note.
4. **Meet them / keep looking** — one person at a time. No stack, no gamification.
5. **Mutual reveal** — when both say yes, names and photos unlock, plus a suggested
   **public** coffee spot near the midpoint.
6. **Plan it** — messaging unlocks *only* after a mutual match, and is nudged toward
   logistics. Matches expire after 24h if you don't coordinate.
7. **Did you meet?** — a lightweight post-coffee prompt that closes the loop.

**Safety throughout:** block & report are available *before* the reveal, the app
only ever suggests public places, you can one-tap "share your plans" with a
trusted contact, and it's 18+.

---

## The matching engine (the core IP)

`lib/matching.ts` scores every eligible person on five signals and ranks them:

- **Distance** (haversine; capped to the same metro)
- **Availability overlap** (now / today / this weekend)
- **Topic overlap** of the two sentences (a small topic lexicon — politics, faith,
  parenting, building things, the planet, …)
- **The challenge dial** — this is the key feature. Low challenge rewards *similar*
  backgrounds; high challenge rewards *different* backgrounds **that still share a
  topic**, so a "surprise me" match is never random.
- **Intent compatibility** — what each person wants *out of* the conversation
  (debate / learn / teach / vent / listen / advice / befriend). Complementary
  intents score highest (one wants to share, one wants to learn), and two passive
  "venters" score lowest. This is the always-on safety valve: even very different
  people are only matched when their conversational intent fits.

It also writes the human-readable **"why you two"** note from those signals.

### Optional: Claude-written rationale

The ranking is always deterministic, so the app works with **zero external
dependencies**. If `ANTHROPIC_API_KEY` is set, `lib/claude.ts` uses Claude
(`claude-opus-4-8`) to rewrite the "why you two" note in justcoffee's voice. With
no key, the built-in rationale is used and the product is identical.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS, with the campaign's palette + Helvetica Neue / Georgia |
| Data | A file-backed JSON store (`lib/db.ts`) behind a small repository API |
| Auth | Signed-cookie session (no passwords for the MVP) |
| Matching | Deterministic engine in `lib/matching.ts` (+ optional Claude) |

The store is deliberately swappable: every call site uses the helpers in
`lib/db.ts`, not the storage mechanism, so moving to Postgres/Supabase later is a
single-module change. The MVP is a responsive, mobile-first web app so the whole
product is viewable in a browser today; the data model, API, and matching logic
all carry over to the eventual React Native build.

---

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
# or a production build:
npm run build && npm run start
```

On first boot the store seeds ~16 demo people (Austin-dense, mirroring the
go-to-market plan) so the matching loop is real with a single live user. Demo
people respond to a "meet them" with a stable yes/no, so mutual matches *and*
"keep looking" both happen. To experience a real two-sided match, open a second
browser, onboard as a second person in the same city, and have each say yes.

### Environment

Copy `.env.example` to `.env.local`. Everything is optional:

- `ANTHROPIC_API_KEY` — enables the Claude-written match rationale.
- `JUSTCOFFEE_SESSION_SECRET` — set any random string in production.

### Handy

- `POST /api/reset` — reseed the demo world and sign out.
- `npm run seed:reset` — delete the local store file.

---

## Project layout

```
app/
  page.tsx                 landing
  onboarding/              profile setup (two sentences, availability, location)
  find/                    challenge dial + search + match card + reveal
  matches/                 list + per-match chat / coffee spot / safety / post-coffee
  api/                     session, profile, search, meet, pass, matches,
                           messages, met, share, safety, reset
lib/
  matching.ts              the ranking engine + "why you two"
  text.ts                  topic + intent detection, similarity
  claude.ts                optional Claude rationale
  db.ts / seed.ts          file-backed store + demo people
  cities.ts                launch cities + public coffee spots
  geo.ts / types.ts / session.ts / auth.ts / actions.ts
components/
  Logo.tsx                 the overlapping-rings + steam mark
  ChallengeSlider.tsx      the similar↔different dial
  MatchCard.tsx  Avatar.tsx
```

---

## What an MVP intentionally leaves for later

Real auth (magic link / OAuth), photo upload + verification, push notifications,
a hosted database, live realtime messaging (this MVP polls), and the native app.
The product surface and matching logic are built to carry into all of them.
