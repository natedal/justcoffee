import type { Candidate, User } from "./types";
import { AVAILABILITY_SHORT } from "./types";
import { detectIntent, INTENT_LABEL } from "./text";

// The AI scorer. When ANTHROPIC_API_KEY is set, Claude ranks the (distance-
// filtered) shortlist itself: it assigns each candidate a 0..1 fit score for the
// requested challenge dial. It returns scores only (compact + fast, since this
// sits in the request path); the "why you two" note for the single winner is
// written separately by lib/claude. The deterministic scorer in lib/matching
// becomes the shortlist prefilter (the hard 30-mile constraint) and the fallback
// whenever the model is unavailable.

const MODEL = process.env.JUSTCOFFEE_CLAUDE_MODEL || "claude-opus-4-8";
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

interface Verdict {
  id: string;
  score: number;
}

function dialDescription(challenge: number): string {
  if (challenge > 0.66)
    return "someone genuinely different from them — a different background or worldview — that they'd never normally cross paths with, as long as there's some human thread to connect on";
  if (challenge < 0.34)
    return "someone on their wavelength — a similar background or outlook — so the conversation feels easy";
  return "someone with enough in common to click but enough difference to stay interesting";
}

/** Pull the first JSON array out of the model's text, tolerating code fences. */
function parseVerdicts(text: string): Verdict[] | null {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("[");
  const end = t.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const parsed = JSON.parse(t.slice(start, end + 1));
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((v) => v && typeof v.id === "string" && typeof v.score === "number")
      .map((v) => ({ id: v.id, score: clamp01(v.score) }));
  } catch {
    return null;
  }
}

/**
 * Re-rank a distance-filtered, deterministically pre-sorted shortlist with Claude.
 * Returns a new Candidate[] sorted by the AI's score, or `null` if the model is
 * disabled/unavailable/unparseable so the caller can fall back to the
 * deterministic ranking. (Rationale for the winner is written separately.)
 */
export async function aiRankCandidates(
  viewer: User,
  shortlist: Candidate[],
  challenge: number,
): Promise<Candidate[] | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (shortlist.length === 0) return [];

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const viewerIntent = INTENT_LABEL[detectIntent(viewer.lookingTo)];
    const system =
      "You are the matching engine for justcoffee, an app that pairs nearby " +
      "strangers for a single, low-stakes, in-person coffee conversation (not " +
      "dating). You decide who a searcher should meet. A great justcoffee match " +
      "hinges on conversational chemistry: complementary intent (one wants to " +
      "share, the other to learn; one to vent, the other to listen), a real " +
      "thread to talk about, and a fit with how adventurous the searcher is " +
      "feeling. Proximity and schedule matter only as tie-breakers.";

    const candidateLines = shortlist
      .map((c) => {
        const shared = c.sharedTopics.length ? ` | shared ground: ${c.sharedTopics.join(", ")}` : "";
        return (
          `- id=${c.id} | "${c.pseudonym}" | is: "${c.iAm}" | wants: "${c.lookingTo}" | ` +
          `${c.distanceMi} mi away | free ${AVAILABILITY_SHORT[c.availability]}${shared}`
        );
      })
      .join("\n");

    const prompt = [
      `The searcher is: "${viewer.iAm}"`,
      `The searcher wants: "${viewer.lookingTo}" (intent: ${viewerIntent}).`,
      `Right now they're dialed toward: ${dialDescription(challenge)}.`,
      "",
      "Candidates:",
      candidateLines,
      "",
      "Score every candidate from 0 to 1 on how good this specific coffee would be " +
        "for the searcher right now (1 = meet them, 0 = skip). Reward complementary " +
        "intent and a real shared thread; honor the dial above.",
      "",
      'Output ONLY a JSON array, no prose, no markdown fences. Each element: ' +
        '{"id": string, "score": number between 0 and 1}.',
    ].join("\n");

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      // No extended thinking and scores-only output: keeps this call fast since it
      // sits in the /api/search request path. The winner's note is written after.
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    const verdicts = parseVerdicts(text);
    if (!verdicts || verdicts.length === 0) return null;

    const byId = new Map(shortlist.map((c) => [c.id, c]));
    const scoreById = new Map(verdicts.map((v) => [v.id, v]));

    const ranked = shortlist
      .map((c) => {
        const v = scoreById.get(c.id);
        if (!v) return { ...c };
        return { ...c, score: Math.round(v.score * 1000) / 1000 };
      })
      // Keep only candidates the model actually scored at the top; unscored ones
      // retain their deterministic score and naturally sink if the model ignored them.
      .sort((a, b) => b.score - a.score);

    return ranked;
  } catch {
    // No network, bad key, rate limit, malformed output: fall back to deterministic.
    return null;
  }
}
