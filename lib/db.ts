import crypto from "node:crypto";
import type {
  User,
  SearchState,
  Match,
  Message,
  Report,
  Block,
} from "./types";
import { supabase } from "./supabase";
import { buildSeedUsers } from "./seed";
import type { Attribution } from "./growth-shared";

// Supabase-backed store. Every call site uses the helpers below, not the storage
// mechanism. Coffee spots live in application code (lib/cities.ts), so there is
// no spots table here. All functions are async.

export const id = (prefix: string) =>
  `${prefix}-${crypto.randomBytes(6).toString("hex")}`;

// --- row <-> object mappers ---------------------------------------------
/* eslint-disable @typescript-eslint/no-explicit-any */

function rowToUser(r: any): User {
  return {
    id: r.id,
    email: r.email ?? undefined,
    name: r.name ?? "",
    age: Number(r.age),
    pseudonym: r.pseudonym ?? "",
    iAm: r.i_am ?? "",
    lookingTo: r.looking_to ?? "",
    avatar: r.avatar ?? { hue: 0, shape: 0 },
    photoUrl: r.photo_url ?? undefined,
    verified: Boolean(r.verified),
    city: r.city ?? "austin",
    lat: Number(r.lat),
    lng: Number(r.lng),
    availability: r.availability ?? "today",
    availabilityMinutes: r.availability_minutes ?? undefined,
    isDemo: Boolean(r.is_demo),
    openness: Number(r.openness),
    createdAt: Number(r.created_at),
  };
}

function userToRow(u: User) {
  return {
    id: u.id,
    email: u.email ?? null,
    name: u.name,
    age: u.age,
    pseudonym: u.pseudonym,
    i_am: u.iAm,
    looking_to: u.lookingTo,
    avatar: u.avatar,
    photo_url: u.photoUrl ?? null,
    verified: Boolean(u.verified),
    city: u.city,
    lat: u.lat,
    lng: u.lng,
    availability: u.availability,
    availability_minutes: u.availabilityMinutes ?? null,
    is_demo: u.isDemo,
    openness: u.openness,
    created_at: u.createdAt,
  };
}

function rowToSearch(r: any): SearchState {
  return {
    userId: r.user_id,
    challenge: Number(r.challenge),
    passed: r.passed ?? [],
    interested: r.interested ?? [],
    currentCandidateId: r.current_candidate_id ?? undefined,
    updatedAt: Number(r.updated_at),
  };
}

function searchToRow(s: SearchState) {
  return {
    user_id: s.userId,
    challenge: s.challenge,
    passed: s.passed,
    interested: s.interested,
    current_candidate_id: s.currentCandidateId ?? null,
    updated_at: s.updatedAt,
  };
}

function rowToMatch(r: any): Match {
  return {
    id: r.id,
    aId: r.a_id,
    bId: r.b_id,
    createdAt: Number(r.created_at),
    expiresAt: Number(r.expires_at),
    coffeeSpotId: r.coffee_spot_id,
    status: r.status,
    met: r.met ?? {},
    challengeAtMatch: Number(r.challenge_at_match),
  };
}

function matchToRow(m: Match) {
  return {
    id: m.id,
    a_id: m.aId,
    b_id: m.bId,
    created_at: m.createdAt,
    expires_at: m.expiresAt,
    coffee_spot_id: m.coffeeSpotId,
    status: m.status,
    met: m.met,
    challenge_at_match: m.challengeAtMatch,
  };
}

function rowToMessage(r: any): Message {
  return { id: r.id, matchId: r.match_id, fromId: r.from_id, body: r.body, at: Number(r.at) };
}

/* eslint-enable @typescript-eslint/no-explicit-any */

// --- Seeding -------------------------------------------------------------
const g = globalThis as unknown as { __jc_seeded?: Promise<void> };

/** Demo personas are seeded unless explicitly disabled (set for real-user tests
 *  so people only ever match with each other, never with a bot). */
export function seedDemoEnabled(): boolean {
  return process.env.JUSTCOFFEE_SEED_DEMO !== "false";
}

async function doSeed(): Promise<void> {
  if (!seedDemoEnabled()) return;
  const sb = supabase();
  const { data } = await sb.from("users").select("id").eq("is_demo", true).limit(1);
  if (data && data.length > 0) return; // already seeded
  const rows = buildSeedUsers().map(userToRow);
  await sb.from("users").upsert(rows, { onConflict: "id" });
}

/** Ensure the demo world exists. Idempotent; safe to call on every request. */
export function ensureSeeded(): Promise<void> {
  if (!g.__jc_seeded) {
    g.__jc_seeded = doSeed().catch((e) => {
      g.__jc_seeded = undefined; // allow retry on next call
      throw e;
    });
  }
  return g.__jc_seeded;
}

export async function resetWorld(): Promise<void> {
  const sb = supabase();
  await Promise.all([
    sb.from("messages").delete().neq("id", ""),
    sb.from("interests").delete().neq("from_id", ""),
    sb.from("blocks").delete().neq("from_id", ""),
    sb.from("reports").delete().neq("id", ""),
    sb.from("matches").delete().neq("id", ""),
    sb.from("searches").delete().neq("user_id", ""),
  ]);
  await sb.from("users").delete().neq("id", "");
  g.__jc_seeded = undefined;
  await ensureSeeded();
}

// --- Users ---------------------------------------------------------------
export async function getUser(userId: string): Promise<User | undefined> {
  const { data } = await supabase().from("users").select("*").eq("id", userId).maybeSingle();
  return data ? rowToUser(data) : undefined;
}
export async function allUsers(): Promise<User[]> {
  const { data } = await supabase().from("users").select("*");
  return (data ?? []).map(rowToUser);
}
export async function getUserByEmail(email: string): Promise<User | undefined> {
  const target = email.trim().toLowerCase();
  const { data } = await supabase().from("users").select("*").eq("email", target).maybeSingle();
  return data ? rowToUser(data) : undefined;
}
export async function upsertUser(u: User): Promise<User> {
  const { error } = await supabase()
    .from("users")
    .upsert(userToRow(u), { onConflict: "id" });
  if (error) {
    // Fail loudly: a silent write failure (e.g. schema drift) previously caused
    // sign-in to loop with no error. Surface it instead.
    console.error("[db] upsertUser failed:", error.message);
    throw new Error(`upsertUser failed: ${error.message}`);
  }
  return u;
}

// --- Search --------------------------------------------------------------
export async function getSearch(userId: string): Promise<SearchState> {
  const { data } = await supabase().from("searches").select("*").eq("user_id", userId).maybeSingle();
  if (data) return rowToSearch(data);
  const fresh: SearchState = {
    userId,
    challenge: 0.5,
    passed: [],
    interested: [],
    updatedAt: Date.now(),
  };
  await setSearch(fresh);
  return fresh;
}
export async function setSearch(s: SearchState): Promise<void> {
  s.updatedAt = Date.now();
  await supabase().from("searches").upsert(searchToRow(s), { onConflict: "user_id" });
}

// --- Interest / matching -------------------------------------------------
export async function recordInterest(fromId: string, toId: string): Promise<void> {
  await supabase()
    .from("interests")
    .upsert({ from_id: fromId, to_id: toId, at: Date.now() }, {
      onConflict: "from_id,to_id",
      ignoreDuplicates: true,
    });
  const s = await getSearch(fromId);
  if (!s.interested.includes(toId)) {
    s.interested.push(toId);
    await setSearch(s);
  }
}
export async function hasInterest(fromId: string, toId: string): Promise<boolean> {
  const { data } = await supabase()
    .from("interests")
    .select("from_id")
    .eq("from_id", fromId)
    .eq("to_id", toId)
    .maybeSingle();
  return Boolean(data);
}

export async function createMatch(m: Match): Promise<Match> {
  await supabase().from("matches").upsert(matchToRow(m), { onConflict: "id" });
  return m;
}
export async function getMatch(matchId: string): Promise<Match | undefined> {
  const { data } = await supabase().from("matches").select("*").eq("id", matchId).maybeSingle();
  return data ? rowToMatch(data) : undefined;
}
export async function updateMatch(m: Match): Promise<void> {
  await supabase().from("matches").upsert(matchToRow(m), { onConflict: "id" });
}
export async function matchesForUser(userId: string): Promise<Match[]> {
  const { data } = await supabase()
    .from("matches")
    .select("*")
    .or(`a_id.eq.${userId},b_id.eq.${userId}`)
    .order("created_at", { ascending: false });
  return (data ?? []).map(rowToMatch);
}
export async function existingMatchBetween(a: string, b: string): Promise<Match | undefined> {
  const { data } = await supabase()
    .from("matches")
    .select("*")
    .or(`and(a_id.eq.${a},b_id.eq.${b}),and(a_id.eq.${b},b_id.eq.${a})`)
    .limit(1)
    .maybeSingle();
  return data ? rowToMatch(data) : undefined;
}

// --- Messages ------------------------------------------------------------
export async function addMessage(m: Message): Promise<Message> {
  await supabase().from("messages").insert({
    id: m.id,
    match_id: m.matchId,
    from_id: m.fromId,
    body: m.body,
    at: m.at,
  });
  return m;
}
export async function messagesForMatch(matchId: string): Promise<Message[]> {
  const { data } = await supabase()
    .from("messages")
    .select("*")
    .eq("match_id", matchId)
    .order("at", { ascending: true });
  return (data ?? []).map(rowToMessage);
}

// --- Safety --------------------------------------------------------------
export async function addReport(r: Report): Promise<void> {
  await supabase().from("reports").insert({
    id: r.id,
    from_id: r.fromId,
    target_id: r.targetId,
    reason: r.reason,
    context: r.context,
    at: r.at,
  });
}
export async function addBlock(b: Block): Promise<void> {
  await supabase()
    .from("blocks")
    .upsert(
      { from_id: b.fromId, target_id: b.targetId, at: b.at },
      { onConflict: "from_id,target_id", ignoreDuplicates: true },
    );
}
export async function blockedPairIds(userId: string): Promise<Set<string>> {
  const { data } = await supabase()
    .from("blocks")
    .select("from_id,target_id")
    .or(`from_id.eq.${userId},target_id.eq.${userId}`);
  const out = new Set<string>();
  for (const b of data ?? []) {
    if (b.from_id === userId) out.add(b.target_id);
    if (b.target_id === userId) out.add(b.from_id);
  }
  return out;
}

// --- Signups (raw email capture for the /growth list) --------------------
// Captures the raw email the moment it's submitted at /signin. Deliberately
// separate from two existing stores: the growth_events spine keeps only an HMAC
// hash (privacy-by-design), and the `users` table only gets a row once the magic
// link is clicked. We also keep this OUT of `users` on purpose — allUsers() feeds
// the matcher, so empty stubs on every email submission would pollute matches.

export interface SignupRow {
  email: string;
  userId?: string;
  verified: boolean;
  variant: string;
  market: string;
  channel: string;
  requests: number;
  firstSeen: number;
  lastSeen: number;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToSignup(r: any): SignupRow {
  return {
    email: r.email,
    userId: r.user_id ?? undefined,
    verified: Boolean(r.verified),
    variant: r.variant ?? "",
    market: r.market ?? "",
    channel: r.channel ?? "",
    requests: Number(r.requests ?? 1),
    firstSeen: Number(r.first_seen),
    lastSeen: Number(r.last_seen),
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** Record (or bump) a raw email submitted at sign-in. Fire-and-forget: never
 *  throws, so a capture failure can't break the sign-in flow. */
export async function recordSignupEmail(
  rawEmail: string,
  attr?: Attribution | null,
): Promise<void> {
  try {
    const email = rawEmail.trim().toLowerCase();
    if (!email) return;
    const sb = supabase();
    const now = Date.now();
    const { data } = await sb
      .from("signups")
      .select("requests, variant, market, channel")
      .eq("email", email)
      .maybeSingle();
    if (data) {
      await sb
        .from("signups")
        .update({
          last_seen: now,
          requests: Number(data.requests ?? 1) + 1,
          // backfill attribution only if it wasn't captured before
          variant: data.variant || attr?.v || "",
          market: data.market || attr?.c || "",
          channel: data.channel || attr?.ch || "",
        })
        .eq("email", email);
    } else {
      await sb.from("signups").insert({
        email,
        verified: false,
        variant: attr?.v ?? "",
        market: attr?.c ?? "",
        channel: attr?.ch ?? "",
        requests: 1,
        first_seen: now,
        last_seen: now,
      });
    }
  } catch {
    /* email capture must never break sign-in */
  }
}

/** Mark a captured signup as verified (magic link clicked) and link the user id.
 *  Inserts a row if one doesn't exist yet (covers users created before capture). */
export async function markSignupVerified(
  rawEmail: string,
  userId: string,
): Promise<void> {
  try {
    const email = rawEmail.trim().toLowerCase();
    if (!email) return;
    const sb = supabase();
    const now = Date.now();
    const { data } = await sb
      .from("signups")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (data) {
      await sb
        .from("signups")
        .update({ verified: true, user_id: userId, last_seen: now })
        .eq("email", email);
    } else {
      await sb.from("signups").insert({
        email,
        user_id: userId,
        verified: true,
        requests: 1,
        first_seen: now,
        last_seen: now,
      });
    }
  } catch {
    /* never break verify */
  }
}

/** Every captured signup email, newest first — for the /growth dashboard. */
export async function listSignups(): Promise<SignupRow[]> {
  const { data } = await supabase()
    .from("signups")
    .select("*")
    .order("first_seen", { ascending: false });
  return (data ?? []).map(rowToSignup);
}

// --- Admin / metrics -----------------------------------------------------
/** Aggregate snapshot of the test, for the protected /api/admin/stats endpoint. */
export async function stats() {
  const sb = supabase();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const count = async (table: string, build?: (q: any) => any): Promise<number> => {
    let q = sb.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count: c } = await q;
    return c ?? 0;
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const [
    realUsers,
    onboarded,
    withPhoto,
    verified,
    totalMatches,
    totalMessages,
  ] = await Promise.all([
    count("users", (q) => q.eq("is_demo", false)),
    count("users", (q) => q.eq("is_demo", false).neq("name", "")),
    count("users", (q) => q.eq("is_demo", false).not("photo_url", "is", null)),
    count("users", (q) => q.eq("is_demo", false).eq("verified", true)),
    count("matches"),
    count("messages"),
  ]);

  const { data: matchRows } = await sb.from("matches").select("met");
  let matchesWithAMessageMet = 0;
  let metYes = 0;
  for (const m of matchRows ?? []) {
    const vals = Object.values((m.met ?? {}) as Record<string, string>);
    if (vals.length) matchesWithAMessageMet++;
    if (vals.includes("yes")) metYes++;
  }

  const { data: fromRows } = await sb.from("messages").select("from_id");
  const distinctMessagers = new Set((fromRows ?? []).map((r) => r.from_id)).size;

  return {
    realUsers,
    onboarded,
    withPhoto,
    verified,
    totalMatches,
    totalMessages,
    distinctMessagers,
    matchesAnsweredMet: matchesWithAMessageMet,
    matchesMetYes: metYes,
    demoSeeding: seedDemoEnabled(),
    at: new Date().toISOString(),
  };
}
