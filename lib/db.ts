import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type {
  DBShape,
  User,
  SearchState,
  Match,
  Message,
  Report,
  Block,
  CoffeeSpot,
} from "./types";
import { COFFEE_SPOTS } from "./cities";
import { buildSeedUsers } from "./seed";

// File-backed JSON store. Single source of truth for the MVP. Swap this module
// for a Postgres/Supabase data layer later — call sites only use the helpers
// exported below, not the storage mechanism.

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

function emptyDB(): DBShape {
  return {
    users: {},
    searches: {},
    interests: [],
    matches: {},
    messages: [],
    reports: [],
    blocks: [],
    spots: COFFEE_SPOTS,
    seeded: false,
  };
}

function seed(db: DBShape): DBShape {
  for (const u of buildSeedUsers()) db.users[u.id] = u;
  db.spots = COFFEE_SPOTS;
  db.seeded = true;
  return db;
}

function load(): DBShape {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      const parsed = JSON.parse(raw) as DBShape;
      // keep coffee spots fresh from code
      parsed.spots = COFFEE_SPOTS;
      return parsed;
    }
  } catch {
    // fall through to a fresh seeded store
  }
  return seed(emptyDB());
}

// Survive Next.js dev hot-reloads by stashing the instance on globalThis.
const g = globalThis as unknown as { __jc_db?: DBShape };
function db(): DBShape {
  if (!g.__jc_db) g.__jc_db = load();
  return g.__jc_db;
}

export function save(): void {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(db(), null, 2), "utf8");
    fs.renameSync(tmp, DB_FILE);
  } catch {
    // best-effort persistence; in-memory state remains correct for the session
  }
}

export function resetWorld(): void {
  g.__jc_db = seed(emptyDB());
  save();
}

export const id = (prefix: string) =>
  `${prefix}-${crypto.randomBytes(6).toString("hex")}`;

// --- Users ---------------------------------------------------------------
export function getUser(userId: string): User | undefined {
  return db().users[userId];
}
export function allUsers(): User[] {
  return Object.values(db().users);
}
export function getUserByEmail(email: string): User | undefined {
  const target = email.trim().toLowerCase();
  return Object.values(db().users).find((u) => u.email === target);
}
export function upsertUser(u: User): User {
  db().users[u.id] = u;
  save();
  return u;
}

// --- Search --------------------------------------------------------------
export function getSearch(userId: string): SearchState {
  const d = db();
  if (!d.searches[userId]) {
    d.searches[userId] = {
      userId,
      challenge: 0.5,
      passed: [],
      interested: [],
      updatedAt: Date.now(),
    };
  }
  return d.searches[userId];
}
export function setSearch(s: SearchState): void {
  s.updatedAt = Date.now();
  db().searches[s.userId] = s;
  save();
}

// --- Interest / matching -------------------------------------------------
export function recordInterest(fromId: string, toId: string): void {
  const d = db();
  if (!d.interests.some((i) => i.fromId === fromId && i.toId === toId)) {
    d.interests.push({ fromId, toId, at: Date.now() });
  }
  const s = getSearch(fromId);
  if (!s.interested.includes(toId)) s.interested.push(toId);
  setSearch(s);
}
export function hasInterest(fromId: string, toId: string): boolean {
  return db().interests.some((i) => i.fromId === fromId && i.toId === toId);
}

export function createMatch(m: Match): Match {
  db().matches[m.id] = m;
  save();
  return m;
}
export function getMatch(matchId: string): Match | undefined {
  return db().matches[matchId];
}
export function updateMatch(m: Match): void {
  db().matches[m.id] = m;
  save();
}
export function matchesForUser(userId: string): Match[] {
  return Object.values(db().matches)
    .filter((m) => m.aId === userId || m.bId === userId)
    .sort((a, b) => b.createdAt - a.createdAt);
}
export function existingMatchBetween(
  a: string,
  b: string,
): Match | undefined {
  return Object.values(db().matches).find(
    (m) =>
      (m.aId === a && m.bId === b) || (m.aId === b && m.bId === a),
  );
}

// --- Messages ------------------------------------------------------------
export function addMessage(m: Message): Message {
  db().messages.push(m);
  save();
  return m;
}
export function messagesForMatch(matchId: string): Message[] {
  return db()
    .messages.filter((m) => m.matchId === matchId)
    .sort((a, b) => a.at - b.at);
}

// --- Safety --------------------------------------------------------------
export function addReport(r: Report): void {
  db().reports.push(r);
  save();
}
export function addBlock(b: Block): void {
  const d = db();
  if (!d.blocks.some((x) => x.fromId === b.fromId && x.targetId === b.targetId)) {
    d.blocks.push(b);
  }
  save();
}
export function blockedPairIds(userId: string): Set<string> {
  const out = new Set<string>();
  for (const b of db().blocks) {
    if (b.fromId === userId) out.add(b.targetId);
    if (b.targetId === userId) out.add(b.fromId);
  }
  return out;
}

// --- Spots ---------------------------------------------------------------
export function getSpot(spotId: string) {
  return db().spots.find((s) => s.id === spotId);
}
export function spotsInCity(city: string) {
  return db().spots.filter((s) => s.city === city);
}
/** Persist a (possibly generated) spot so it resolves on later reads. */
export function addSpot(spot: CoffeeSpot): CoffeeSpot {
  const d = db();
  const existing = d.spots.find((s) => s.id === spot.id);
  if (existing) return existing;
  d.spots.push(spot);
  save();
  return spot;
}
