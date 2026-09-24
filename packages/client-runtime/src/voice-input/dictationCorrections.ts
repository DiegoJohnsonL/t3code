import type { VoiceCorrection } from "@t3tools/contracts";

const MAX_CORRECTION_WORDS = 4;
const MAX_CORRECTIONS = 20;

type Word = { readonly text: string; readonly key: string };

function words(text: string): ReadonlyArray<Word> {
  return (text.match(/[\p{L}\p{N}][\p{L}\p{N}'’._/@-]*/gu) ?? []).map((word) => {
    const trimmed = word.replace(/[._/@-]+$/, "");
    return { text: trimmed, key: trimmed.toLowerCase() };
  });
}

/** Longest common subsequence of word keys, as index pairs in order. */
function matchWords(
  left: ReadonlyArray<Word>,
  right: ReadonlyArray<Word>,
): ReadonlyArray<readonly [number, number]> {
  const lengths = Array.from({ length: left.length + 1 }, () =>
    Array<number>(right.length + 1).fill(0),
  );
  for (let i = left.length - 1; i >= 0; i -= 1) {
    for (let j = right.length - 1; j >= 0; j -= 1) {
      lengths[i]![j] =
        left[i]!.key === right[j]!.key
          ? lengths[i + 1]![j + 1]! + 1
          : Math.max(lengths[i + 1]![j]!, lengths[i]![j + 1]!);
    }
  }
  const pairs: Array<readonly [number, number]> = [];
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i]!.key === right[j]!.key) {
      pairs.push([i, j]);
      i += 1;
      j += 1;
    } else if (lengths[i + 1]![j]! >= lengths[i]![j + 1]!) {
      i += 1;
    } else {
      j += 1;
    }
  }
  return pairs;
}

function uppercaseCount(text: string): number {
  return text.replace(/[^\p{Lu}]/gu, "").length;
}

/**
 * Runs of matched words the user capitalized ("effect schema" → "Effect Schema"),
 * joined with an unchanged capitalized neighbor so multi-word names stay whole.
 * Lowering a capital, as at the start of a sentence the user typed before, is not a fix.
 */
function capitalizationFixes(
  dictatedWords: ReadonlyArray<Word>,
  sentWords: ReadonlyArray<Word>,
  pairs: ReadonlyArray<readonly [number, number]>,
): ReadonlyArray<VoiceCorrection> {
  const gainsCapital = ([i, j]: readonly [number, number]) =>
    uppercaseCount(sentWords[j]!.text) > uppercaseCount(dictatedWords[i]!.text);
  const isCapitalized = ([i, j]: readonly [number, number]) =>
    dictatedWords[i]!.text === sentWords[j]!.text && uppercaseCount(sentWords[j]!.text) > 0;
  const fixes: Array<VoiceCorrection> = [];
  let index = 0;
  while (index < pairs.length) {
    if (!gainsCapital(pairs[index]!)) {
      index += 1;
      continue;
    }
    let start = index;
    let end = index + 1;
    while (end < pairs.length && gainsCapital(pairs[end]!)) end += 1;
    if (start > 0 && isCapitalized(pairs[start - 1]!)) start -= 1;
    if (end < pairs.length && isCapitalized(pairs[end]!)) end += 1;
    const run = pairs.slice(start, end);
    fixes.push({
      dictated: run.map(([i]) => dictatedWords[i]!.text).join(" "),
      corrected: run.map(([, j]) => sentWords[j]!.text).join(" "),
    });
    index = end;
  }
  return fixes;
}

/**
 * Short replacements the user made inside dictated text before sending, such as
 * "tan stack" → "TanStack". A dictation that was mostly rewritten yields nothing;
 * the environment decides which replacements were spelling fixes worth learning.
 */
export function findDictationCorrections(input: {
  readonly dictated: ReadonlyArray<string>;
  readonly sent: string;
}): ReadonlyArray<VoiceCorrection> {
  const sentWords = words(input.sent);
  const corrections: Array<VoiceCorrection> = [];
  for (const segment of input.dictated) {
    const dictatedWords = words(segment);
    if (dictatedWords.length === 0) continue;
    const pairs = matchWords(dictatedWords, sentWords);
    if (pairs.length < dictatedWords.length / 2) continue;
    const firstMatch = pairs[0];
    const lastMatch = pairs.at(-1);
    if (!firstMatch || !lastMatch) continue;
    // Before the first and after the last matched word, the sent side has no
    // boundary of its own, so it takes as many words as were dictated there.
    const leadingWords = firstMatch[0];
    const trailingWords = dictatedWords.length - lastMatch[0] - 1;
    const anchors: ReadonlyArray<readonly [number, number]> = [
      [-1, firstMatch[1] - leadingWords - 1],
      ...pairs,
      [dictatedWords.length, lastMatch[1] + trailingWords + 1],
    ];
    for (let index = 0; index + 1 < anchors.length; index += 1) {
      const [dictatedStart, sentStart] = anchors[index]!;
      const [dictatedEnd, sentEnd] = anchors[index + 1]!;
      const before = dictatedWords.slice(dictatedStart + 1, dictatedEnd);
      const after = sentWords.slice(Math.max(0, sentStart + 1), sentEnd);
      if (
        before.length === 0 ||
        after.length === 0 ||
        before.length > MAX_CORRECTION_WORDS ||
        after.length > MAX_CORRECTION_WORDS
      ) {
        continue;
      }
      const dictated = before.map((word) => word.text).join(" ");
      const corrected = after.map((word) => word.text).join(" ");
      if (dictated !== corrected) corrections.push({ dictated, corrected });
    }
    corrections.push(...capitalizationFixes(dictatedWords, sentWords, pairs));
  }
  return corrections.slice(0, MAX_CORRECTIONS);
}
