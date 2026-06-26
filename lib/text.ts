// Text understanding for matching: tokenize, detect conversation topics, and
// classify conversational *intent* from the two free-text sentences.
//
// This is intentionally transparent + deterministic so the app works with zero
// external dependencies. When ANTHROPIC_API_KEY is present, lib/claude.ts layers
// a Claude-written rationale on top of these signals.

const STOPWORDS = new Set(
  `a an the and or but if then so to of in on for with about from into over under
   i im i'm me my we our you your he she they it that this these those is am are was
   were be been being do does did doing have has had having will would can could should
   want wants looking like just really very someone somebody people person who whom
   want's na gonna wanna out up down get got really kind sort bit more most some any
   talk talking chat conversation coffee meet someone stranger`
    .split(/\s+/)
    .map((w) => w.trim())
    .filter(Boolean),
);

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

// --- Topics ---------------------------------------------------------------
// Broadly defined subject areas. A user can match on a shared topic even if
// they come at it from opposite directions (the whole point of justcoffee).
const TOPIC_LEXICON: Record<string, string[]> = {
  politics: ["politics", "political", "liberal", "conservative", "republican", "democrat", "left", "right", "progressive", "libertarian", "election", "vote", "policy", "government", "aisle"],
  faith: ["faith", "religion", "religious", "god", "church", "spiritual", "christian", "muslim", "jewish", "buddhist", "atheist", "agnostic", "belief", "meaning"],
  parenting: ["parent", "parenting", "kids", "children", "mom", "dad", "mother", "father", "family", "newborn", "toddler"],
  startups: ["startup", "startups", "founder", "entrepreneur", "business", "company", "product", "saas", "vc", "fundraise", "bootstrapped"],
  tech: ["tech", "engineer", "engineering", "software", "developer", "coding", "code", "ai", "data", "machine", "design", "product"],
  art: ["art", "artist", "painting", "drawing", "creative", "design", "film", "photography", "poetry", "writing", "writer", "novel"],
  music: ["music", "musician", "band", "guitar", "piano", "singer", "songwriter", "jazz", "concert", "album", "vinyl"],
  sports: ["sports", "soccer", "basketball", "running", "climbing", "cycling", "tennis", "athlete", "team", "marathon"],
  fitness: ["fitness", "gym", "lifting", "workout", "yoga", "health", "training", "wellness"],
  climate: ["climate", "environment", "sustainability", "carbon", "planet", "green", "nature", "conservation"],
  books: ["books", "book", "reading", "literature", "novel", "author", "philosophy", "philosophical", "ideas"],
  food: ["food", "cooking", "chef", "baking", "restaurant", "foodie", "recipe", "cuisine", "wine"],
  career: ["career", "job", "work", "burnout", "promotion", "industry", "professional", "corporate", "quit", "switching"],
  philosophy: ["philosophy", "meaning", "existential", "ethics", "morality", "purpose", "consciousness", "stoic"],
  loneliness: ["lonely", "loneliness", "isolated", "friends", "friendship", "connection", "community", "belonging", "new", "moved"],
  immigration: ["immigration", "immigrant", "border", "refugee", "citizenship"],
  mentalhealth: ["anxiety", "depression", "therapy", "mental", "healing", "grief", "recovery", "burnout"],
  travel: ["travel", "traveling", "backpacking", "abroad", "expat", "cultures", "languages", "language"],
  money: ["money", "finance", "investing", "fire", "frugal", "debt", "wealth", "economics"],
};

export function detectTopics(text: string): string[] {
  const toks = new Set(tokenize(text));
  const hits: string[] = [];
  for (const [topic, words] of Object.entries(TOPIC_LEXICON)) {
    if (words.some((w) => toks.has(w))) hits.push(topic);
  }
  return hits;
}

export const TOPIC_LABEL: Record<string, string> = {
  politics: "politics",
  faith: "faith & meaning",
  parenting: "parenting",
  startups: "building things",
  tech: "tech",
  art: "art & making",
  music: "music",
  sports: "sports",
  fitness: "fitness",
  climate: "the planet",
  books: "books & ideas",
  food: "food",
  career: "work & careers",
  philosophy: "the big questions",
  loneliness: "connection",
  immigration: "immigration",
  mentalhealth: "mental health",
  travel: "travel & cultures",
  money: "money",
};

// --- Intent ---------------------------------------------------------------
// What the person wants *out of* the conversation. Complementary intents make
// the best matches; two identical "venters" make the weakest.
export type Intent =
  | "debate" // wants to be challenged / argue respectfully
  | "learn" // wants to understand a different perspective
  | "teach" // wants to share their perspective / experience
  | "vent" // wants to be heard
  | "listen" // wants to hear someone else's story
  | "advice" // seeking guidance / mentorship
  | "befriend" // wants community / new friends
  | "open"; // no strong signal — just open to talking

const INTENT_CUES: Record<Exclude<Intent, "open">, string[]> = {
  debate: ["debate", "challenge", "argue", "disagree", "pushback", "push", "convince", "opposing", "other side", "different views", "change my mind", "devils advocate"],
  learn: ["learn", "understand", "curious", "why", "perspective", "different", "open my", "broaden", "see how", "hear why", "unlike"],
  teach: ["share", "explain", "teach", "tell", "my story", "my experience", "what its like", "represent", "show"],
  vent: ["vent", "rant", "get off my chest", "frustrated", "stressed", "overwhelmed", "process", "struggling"],
  listen: ["listen", "hear", "hear someone", "their story", "be there", "support", "lend an ear"],
  advice: ["advice", "guidance", "mentor", "help me", "figure out", "decision", "stuck", "career advice", "wisdom"],
  befriend: ["friends", "friend", "community", "new to", "moved", "meet people", "belong", "lonely", "company", "make a connection"],
};

export function detectIntent(text: string): Intent {
  const lower = " " + text.toLowerCase().replace(/['']/g, "") + " ";
  let best: Intent = "open";
  let bestScore = 0;
  for (const [intent, cues] of Object.entries(INTENT_CUES) as [
    Exclude<Intent, "open">,
    string[],
  ][]) {
    let score = 0;
    for (const cue of cues) if (lower.includes(cue)) score += cue.includes(" ") ? 2 : 1;
    if (score > bestScore) {
      bestScore = score;
      best = intent;
    }
  }
  return best;
}

// How compatible two intents are (0..1). Complementary > identical-but-passive.
const COMPLEMENT: Record<string, number> = {
  "debate|debate": 0.95, // two people who both want a respectful argument: great
  "teach|learn": 1.0,
  "vent|listen": 1.0,
  "advice|teach": 0.9,
  "advice|listen": 0.7,
  "learn|learn": 0.6,
  "befriend|befriend": 0.9,
  "vent|vent": 0.35, // two venters: the weakest pairing
  "debate|learn": 0.85,
  "debate|teach": 0.8,
  "open|open": 0.6,
};

export function intentCompatibility(a: Intent, b: Intent): number {
  if (a === b) {
    const k = `${a}|${b}`;
    if (k in COMPLEMENT) return COMPLEMENT[k];
    return 0.65;
  }
  const k1 = `${a}|${b}`;
  const k2 = `${b}|${a}`;
  if (k1 in COMPLEMENT) return COMPLEMENT[k1];
  if (k2 in COMPLEMENT) return COMPLEMENT[k2];
  // unspecified mixed pairs: mildly positive, anything pairs with "open"
  if (a === "open" || b === "open") return 0.6;
  return 0.55;
}

export const INTENT_LABEL: Record<Intent, string> = {
  debate: "a respectful argument",
  learn: "to understand a different view",
  teach: "to share their perspective",
  vent: "to be heard",
  listen: "to listen",
  advice: "some guidance",
  befriend: "a new friend",
  open: "an open conversation",
};

// --- Similarity -----------------------------------------------------------
/** Cosine-ish similarity over token sets (0..1). */
export function tokenSimilarity(a: string, b: string): number {
  const ta = new Set(tokenize(a));
  const tb = new Set(tokenize(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.sqrt(ta.size * tb.size);
}

export function topicOverlap(a: string[], b: string[]): string[] {
  const sb = new Set(b);
  return a.filter((t) => sb.has(t));
}
