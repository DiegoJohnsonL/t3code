import {
  type CustomBackgroundImageSource,
  type CustomBackgroundSource,
  type CustomBackgroundFilter,
  type CustomBackgroundFilterKind,
  type CustomBackgroundImageId,
  type CustomBackgroundRecord,
  DEFAULT_CUSTOM_BACKGROUND_DIM,
  DEFAULT_CUSTOM_BACKGROUND_FADE,
  DEFAULT_CUSTOM_BACKGROUND_FADE_HEIGHT,
  DEFAULT_CUSTOM_BACKGROUND_ROTATION_MINUTES,
  defaultCustomBackgroundFilter,
  isGenerativeCustomBackgroundFilter,
} from "@t3tools/contracts";

export type CustomBackgroundLibrary = ReadonlyArray<CustomBackgroundRecord>;
export type CustomBackgroundRouteKind = "draft" | "conversation" | "other";

export function nextNewBackgroundName(library: CustomBackgroundLibrary): string {
  const taken = new Set(library.map((record) => record.name.toLowerCase()));
  for (let index = 1; ; index += 1) {
    const candidate = `New Background ${index}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
}

export function createGenerativeBackground(input: {
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
    dim: DEFAULT_CUSTOM_BACKGROUND_DIM,
    fadeHeight: DEFAULT_CUSTOM_BACKGROUND_FADE_HEIGHT,
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

// Keep the image reference so switching back from a generative filter restores it.
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

export function backgroundUsesStoredImage(
  record: CustomBackgroundRecord,
  filtersAvailable: boolean,
): record is CustomBackgroundRecord & { source: CustomBackgroundImageSource } {
  return (
    record.source.kind === "image" &&
    (!filtersAvailable || !isGenerativeCustomBackgroundFilter(record.filter.kind))
  );
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
  if (filter.kind === "none" || !filtersAvailable) return hasImage ? "image" : "none";
  if (isGenerativeCustomBackgroundFilter(filter.kind)) return "shader";
  return hasImage ? "shader" : "none";
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

export function currentBackgroundImageId(
  source: CustomBackgroundSource,
  now: number,
): CustomBackgroundImageId | null {
  if (source.kind !== "image") return null;
  const index = Math.floor(now / rotationIntervalMs(source)) % source.imageIds.length;
  return source.imageIds[index] ?? null;
}

/** The image that follows the current one, so it can be fetched before the switch. */
export function upcomingBackgroundImageId(
  source: CustomBackgroundSource,
  now: number,
): CustomBackgroundImageId | null {
  if (source.kind !== "image" || source.imageIds.length < 2) return null;
  return currentBackgroundImageId(source, now + rotationIntervalMs(source));
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

export function toggleBackgroundImage(
  source: CustomBackgroundSource,
  imageId: CustomBackgroundImageId,
): CustomBackgroundSource {
  if (source.kind !== "image") {
    return {
      kind: "image",
      imageIds: [imageId],
      rotationMinutes: DEFAULT_CUSTOM_BACKGROUND_ROTATION_MINUTES,
    };
  }
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
  if (source.kind !== "image") {
    return {
      kind: "image",
      imageIds: [imageId],
      rotationMinutes: DEFAULT_CUSTOM_BACKGROUND_ROTATION_MINUTES,
    };
  }
  return source.imageIds.includes(imageId)
    ? source
    : { ...source, imageIds: [...source.imageIds, imageId] };
}

export function sourcesEqual(a: CustomBackgroundSource, b: CustomBackgroundSource): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind !== "image" || b.kind !== "image") return true;
  return (
    a.rotationMinutes === b.rotationMinutes &&
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

export function resolveDisplayedBackground({
  selected,
  preview,
  enabled,
  editing,
  routeKind,
  inConversations,
}: {
  selected: CustomBackgroundRecord | null;
  preview: CustomBackgroundRecord | null;
  enabled: boolean;
  editing: boolean;
  routeKind: CustomBackgroundRouteKind;
  inConversations: boolean;
}): CustomBackgroundRecord | null {
  if (!enabled || routeKind === "other" || (routeKind === "conversation" && !inConversations)) {
    return null;
  }
  return editing && preview?.id === selected?.id ? preview : selected;
}
