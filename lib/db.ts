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

async function doSeed(): Promise<void> {
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
  await supabase().from("users").upsert(userToRow(u), { onConflict: "id" });
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
