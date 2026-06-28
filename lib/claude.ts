import type { User } from "./types";
import type { MatchSignals } from "./matching";
import { INTENT_LABEL } from "./text";

// Optional AI layer. The matching *ranking* is always deterministic (lib/matching);
// when ANTHROPIC_API_KEY is set, Claude rewrites the "why you two" rationale for the
// chosen candidate in justcoffee's voice. Without a key this is a no-op and the
// built-in rationale is used — the product loop is identical either way.

const MODEL = process.env.JUSTCOFFEE_CLAUDE_MODEL || "claude-opus-4-8";

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export interface Rationale {
  note: string; // the "why you two" note (1-2 sentences)
  topics: string[]; // 3-5 concrete conversation starters for these two
}

/** Pull the first JSON object out of the model's text, tolerating code fences. */
function parseRationale(text: string): Rationale | null {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const obj = JSON.parse(t.slice(start, end + 1));
    const note = typeof obj.note === "string" ? obj.note.trim() : "";
    const topics = Array.isArray(obj.topics)
      ? obj.topics
          .filter((x: unknown): x is string => typeof x === "string")
          .map((s: string) => s.trim())
          .filter(Boolean)
          .slice(0, 5)
      : [];
    if (!note) return null;
    return { note, topics };
  } catch {
    return null;
  }
}

export async function enhanceRationale(
  viewer: User,
  cand: User,
  signals: MatchSignals,
  challenge: number,
): Promise<Rationale | null> {
  if (!aiEnabled()) return null;
  try {
    // Lazy import so the dependency is never loaded on the no-key path.
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();

    const dial =
      challenge > 0.66 ? "different from me" : challenge < 0.34 ? "like me" : "open";
    const system =
      "You write for justcoffee, an app that pairs nearby strangers for a single, " +
      "low-stakes coffee conversation (not dating). Voice: lowercase, warm, dry, " +
      "concrete, never salesy. No emoji, no hype. You produce two things a user " +
      "reads before deciding whether to meet: a short 'why you two' note, and a few " +
      "concrete things they could actually talk about.";
    const prompt = [
      `The searcher wants someone ${dial}.`,
      `Searcher — is: "${viewer.iAm}" / wants: "${viewer.lookingTo}" (intent: ${INTENT_LABEL[signals.viewerIntent]}).`,
      `Candidate "${cand.pseudonym}" — is: "${cand.iAm}" / wants: "${cand.lookingTo}" (intent: ${INTENT_LABEL[signals.candIntent]}).`,
      `They're ${signals.distanceMi.toFixed(1)} miles apart.`,
      signals.sharedTopics.length
        ? `Shared ground: ${signals.sharedTopics.join(", ")}.`
        : `No obvious shared topic — find the human thread.`,
      "",
      "Return ONLY a JSON object, no prose, no markdown fences:",
      '{"note": string, "topics": string[]}',
      `- "note": the 'why you two' note, max 2 sentences, refer to the candidate as "${cand.pseudonym}".`,
      '- "topics": 3 to 5 specific, inviting conversation starters grounded in what these two ' +
        "actually said — things to get into over coffee, not generic small talk. Each a short phrase " +
        "(roughly 3-8 words), lowercase, no trailing punctuation.",
    ].join("\n");

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      system,
      messages: [{ role: "user", content: prompt }],
    });

    const text = res.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();
    return parseRationale(text);
  } catch (err) {
    // Any failure (no network, bad key, bad model, rate limit) falls back to the
    // built-in rationale — but log it, so a misconfiguration doesn't hide silently.
    console.error(
      `[claude] rationale generation failed (model="${MODEL}"):`,
      err instanceof Error ? err.message : err,
    );
    return null;
  }
}
