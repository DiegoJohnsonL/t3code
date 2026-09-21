import {
  type CustomBackgroundImageSource,
  type CustomBackgroundSource,
  type CustomBackgroundFilter,
  type CustomBackgroundFilterKind,
  type CustomBackgroundImageId,
  type CustomBackgroundRecord,
  DEFAULT_CUSTOM_BACKGROUND_FADE,
  DEFAULT_CUSTOM_BACKGROUND_FADE_HEIGHT,
  DEFAULT_CUSTOM_BACKGROUND_DIM,
  DEFAULT_CUSTOM_BACKGROUND_OPACITY,
  DEFAULT_CUSTOM_BACKGROUND_ROTATION_MINUTES,
  defaultCustomBackgroundFilter,
} from "@t3tools/contracts";

export type CustomBackgroundLibrary = ReadonlyArray<CustomBackgroundRecord>;
export type CustomBackgroundRouteKind = "draft" | "conversation" | "other";

export function nextNewBackgroundName(library: CustomBackgroundLibrary): string {
  const taken = new Set(library.map((record) => record.name.toLowerCase()));
  for (let index = 1; ; index += 1) {
    const candidate = `New Playlist ${index}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function createEmptyBackground(input: {
  id: string;
  name: string;
  filter: CustomBackgroundFilter;
  createdAt: string;
}): CustomBackgroundRecord {
  return {
    id: input.id,
    name: input.name,
    source: { kind: "none" },
    filter: input.filter,
    fade: DEFAULT_CUSTOM_BACKGROUND_FADE,
    fadeHeight: DEFAULT_CUSTOM_BACKGROUND_FADE_HEIGHT,
    dim: DEFAULT_CUSTOM_BACKGROUND_DIM,
    opacity: DEFAULT_CUSTOM_BACKGROUND_OPACITY,
    createdAt: input.createdAt,
  };
}

export function upsertBackground(
  library: CustomBackgroundLibrary,
  record: CustomBackgroundRecord,
): CustomBackgroundLibrary {
  const index = library.findIndex((candidate) => candidate.id === record.id);
  if (index === -1) return [...library, record];
  return library.map((candidate, position) => (position === index ? record : candidate));
}

export function removeBackground(
  library: CustomBackgroundLibrary,
  id: string,
): CustomBackgroundLibrary {
  return library.filter((record) => record.id !== id);
}

export function withFilterKind(
  record: CustomBackgroundRecord,
  kind: CustomBackgroundFilterKind,
): CustomBackgroundRecord {
  if (record.filter.kind === kind) return record;
  return { ...record, filter: defaultCustomBackgroundFilter(kind) };
}

export function nextActiveAfterRemove(activeId: string | null, removedId: string): string | null {
  return activeId === removedId ? null : activeId;
}

export function backgroundDrawMode({
  filter,
  hasImage,
  filtersAvailable,
}: {
  filter: CustomBackgroundFilter;
  hasImage: boolean;
  filtersAvailable: boolean;
}): "image" | "shader" | "none" {
  if (!hasImage) return "none";
  return filter.kind === "none" || !filtersAvailable ? "image" : "shader";
}

export function backgroundIsRenderable(
  record: CustomBackgroundRecord,
  filtersAvailable = true,
): boolean {
  return (
    backgroundDrawMode({
      filter: record.filter,
      hasImage: record.source.kind === "image",
      filtersAvailable,
    }) !== "none"
  );
}

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

function singleImageSource(imageId: CustomBackgroundImageId): CustomBackgroundImageSource {
  return {
    kind: "image",
    imageIds: [imageId],
    rotationMinutes: DEFAULT_CUSTOM_BACKGROUND_ROTATION_MINUTES,
    order: "sequential",
    transition: "fade",
  };
}

export function toggleBackgroundImage(
  source: CustomBackgroundSource,
  imageId: CustomBackgroundImageId,
): CustomBackgroundSource {
  if (source.kind !== "image") return singleImageSource(imageId);
  if (!source.imageIds.includes(imageId)) {
    return { ...source, imageIds: [...source.imageIds, imageId] };
  }
  const remaining = source.imageIds.filter((id) => id !== imageId);
  return remaining.length === 0 ? { kind: "none" } : { ...source, imageIds: remaining };
}

export function appendBackgroundImage(
  source: CustomBackgroundSource,
  imageId: CustomBackgroundImageId,
): CustomBackgroundImageSource {
  if (source.kind !== "image") return singleImageSource(imageId);
  return source.imageIds.includes(imageId)
    ? source
    : { ...source, imageIds: [...source.imageIds, imageId] };
}

export function sourcesEqual(a: CustomBackgroundSource, b: CustomBackgroundSource): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind !== "image" || b.kind !== "image") return true;
  return (
    a.rotationMinutes === b.rotationMinutes &&
    a.order === b.order &&
    a.transition === b.transition &&
    a.imageIds.length === b.imageIds.length &&
    a.imageIds.every((id, index) => id === b.imageIds[index])
  );
}

export function filtersEqual(a: CustomBackgroundFilter, b: CustomBackgroundFilter): boolean {
  if (a.kind !== b.kind) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const left: unknown = Reflect.get(a, key);
    const right: unknown = Reflect.get(b, key);
    if (Array.isArray(left) && Array.isArray(right)) {
      if (left.length !== right.length) return false;
      if (left.some((value, index) => value !== right[index])) return false;
      continue;
    }
    if (left !== right) return false;
  }
  return true;
}

/** The background in effect app-wide: the studio's live edits while it is open, else the saved pick. */
export function resolveActiveBackground({
  selected,
  preview,
  enabled,
  editing,
}: {
  selected: CustomBackgroundRecord | null;
  preview: CustomBackgroundRecord | null;
  enabled: boolean;
  editing: boolean;
}): CustomBackgroundRecord | null {
  if (!enabled) return null;
  return editing && preview?.id === selected?.id ? preview : selected;
}

/** The background painted behind a route; only chat routes draw one. */
export function resolveDisplayedBackground({
  routeKind,
  ...active
}: Parameters<typeof resolveActiveBackground>[0] & {
  routeKind: CustomBackgroundRouteKind;
}): CustomBackgroundRecord | null {
  return routeKind === "other" ? null : resolveActiveBackground(active);
}
