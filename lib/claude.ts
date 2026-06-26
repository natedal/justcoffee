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

export async function enhanceRationale(
  viewer: User,
  cand: User,
  signals: MatchSignals,
  challenge: number,
): Promise<string | null> {
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
      "concrete, never salesy. You write the one- to two-sentence 'why you two' note " +
      "a user reads before deciding whether to meet. No names, no emoji, no hype.";
    const prompt = [
      `The searcher wants someone ${dial}.`,
      `Searcher — is: "${viewer.iAm}" / wants: "${viewer.lookingTo}" (intent: ${INTENT_LABEL[signals.viewerIntent]}).`,
      `Candidate "${cand.pseudonym}" — is: "${cand.iAm}" / wants: "${cand.lookingTo}" (intent: ${INTENT_LABEL[signals.candIntent]}).`,
      `They're ${signals.distanceMi.toFixed(1)} miles apart.`,
      signals.sharedTopics.length
        ? `Shared ground: ${signals.sharedTopics.join(", ")}.`
        : `No obvious shared topic — find the human thread.`,
      "",
      "Write the 'why you two' note (max 2 sentences). Refer to the candidate as " +
        `"${cand.pseudonym}". Output only the note.`,
    ].join("\n");

    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
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
    return text || null;
  } catch {
    // Any failure (no network, bad key, rate limit) falls back to the built-in rationale.
    return null;
  }
}
