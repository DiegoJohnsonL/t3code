import type {
  CustomBackgroundImageId,
  CustomBackgroundImageSource,
  CustomBackgroundSource,
} from "@t3tools/contracts";

/**
 * Which picture a rotating background shows is a pure function of the wall
 * clock, so every client showing the same playlist lands on the same picture.
 */

function rotationIntervalMs(source: CustomBackgroundImageSource): number {
  return source.rotationMinutes * 60_000;
}

function mod(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

// mulberry32: tiny seeded generator so every client agrees on the shuffle.
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rawShuffle(count: number, round: number): number[] {
  const random = seededRandom(Math.imul(round + 1, 0x9e3779b1) ^ count);
  const order = Array.from({ length: count }, (_, index) => index);
  for (let index = count - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [order[index], order[swap]] = [order[swap]!, order[index]!];
  }
  return order;
}

/**
 * One round plays every image once. Swapping the first two entries when a
 * round would open with the image the previous one closed on keeps the last
 * entry untouched, so the previous round's closer is always its raw closer.
 */
export function shuffledOrder(count: number, round: number): ReadonlyArray<number> {
  if (count < 3) return Array.from({ length: count }, (_, index) => index);
  const order = rawShuffle(count, round);
  if (round > 0 && order[0] === rawShuffle(count, round - 1)[count - 1]) {
    [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order;
}

function imageIndexForSlot(source: CustomBackgroundImageSource, slot: number): number {
  const count = source.imageIds.length;
  if (source.order === "sequential") return mod(slot, count);
  const round = Math.floor(slot / count);
  return shuffledOrder(count, round)[mod(slot, count)] ?? 0;
}

/** `offset` is how many manual steps the user took with next/previous; it shifts the clock slot. */
export function currentBackgroundImageId(
  source: CustomBackgroundSource,
  now: number,
  offset = 0,
): CustomBackgroundImageId | null {
  if (source.kind !== "image") return null;
  const slot = Math.floor(now / rotationIntervalMs(source)) + offset;
  return source.imageIds[imageIndexForSlot(source, slot)] ?? null;
}

/** The image that follows the current one, so it can be fetched before the switch. */
export function upcomingBackgroundImageId(
  source: CustomBackgroundSource,
  now: number,
  offset = 0,
): CustomBackgroundImageId | null {
  if (source.kind !== "image" || source.imageIds.length < 2) return null;
  return currentBackgroundImageId(source, now, offset + 1);
}

/** Wall-clock time of the next image switch; null when there is nothing to rotate. */
export function nextBackgroundRotationAt(
  source: CustomBackgroundSource,
  now: number,
): number | null {
  if (source.kind !== "image" || source.imageIds.length < 2) return null;
  const interval = rotationIntervalMs(source);
  return (Math.floor(now / interval) + 1) * interval;
}
