import type { VoiceCorrection } from "@t3tools/contracts";

const MAX_LEARNED_TERM_LENGTH = 60;

export const CORRECTION_REVIEW_SYSTEM_PROMPT = `A user dictated text with speech-to-text, then edited it before sending. You receive pairs of what was dictated and what the user changed it to. Decide which pairs fix a word or name the transcriber got wrong, so the corrected spelling can be remembered.

Keep a pair only when both hold:
- Read aloud, the dictated words sound like the corrected ones, even when they are spelled very differently, or they differ only in spelling, spacing, or capitalization ("tan stack" → "TanStack", "for sell" → "Vercel", "grok" → "Groq", "tea three code" → "T3 Code", "use state" → "useState").
- The corrected text is a name, product, library, service, technical term, or code identifier, not a common word.

Reject rewording, synonyms, added or removed ideas, grammar fixes, and common words. Reply with the corrected terms to remember, one per line, exactly as the user wrote them. Reply with nothing if no pair qualifies.`;

export function buildCorrectionReviewPrompt(corrections: ReadonlyArray<VoiceCorrection>): string {
  return corrections
    .map(
      (correction, index) =>
        `${index + 1}. dictated: "${correction.dictated}" → corrected: "${correction.corrected}"`,
    )
    .join("\n");
}

/** Terms the reviewer kept, limited to text the user actually typed. */
export function parseReviewedTerms(
  reply: string,
  corrections: ReadonlyArray<VoiceCorrection>,
): ReadonlyArray<string> {
  const terms = reply
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "")
        .replace(/^["'`]+|["'`]+$/g, "")
        .trim(),
    )
    .filter(
      (term) =>
        term.length >= 2 &&
        term.length <= MAX_LEARNED_TERM_LENGTH &&
        corrections.some((correction) => correction.corrected.includes(term)),
    );
  return [...new Set(terms)];
}

/** Newly learned terms first, skipping ones already known or forgotten. */
export function mergeLearnedVocabulary(input: {
  readonly reviewed: ReadonlyArray<string>;
  readonly vocabulary: ReadonlyArray<string>;
  readonly learned: ReadonlyArray<string>;
  readonly forgotten: ReadonlyArray<string>;
  readonly limit: number;
}): { readonly added: ReadonlyArray<string>; readonly learned: ReadonlyArray<string> } {
  const known = new Set(
    [...input.vocabulary, ...input.learned, ...input.forgotten].map((term) => term.toLowerCase()),
  );
  const added = input.reviewed.filter((term) => !known.has(term.toLowerCase()));
  return { added, learned: [...added, ...input.learned].slice(0, input.limit) };
}
