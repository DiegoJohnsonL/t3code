import type { CustomBackgroundRecord } from "@t3tools/contracts";

import type { ThemeAppearance } from "./themePalettes";

/** How loud a picture is behind text: its mean lightness and colorfulness, each 0 to 1. */
export interface PictureTone {
  readonly lightness: number;
  readonly colorfulness: number;
}

/**
 * How far a picture may lean toward the text color before it gets adjusted:
 * a night sky under a dark theme already reads well at the chosen values.
 */
const NEUTRAL_LOUDNESS = 0.25;
/**
 * Saturated reds and oranges compete with text as much as white does while
 * measuring only mid lightness, so colorfulness counts toward loudness too.
 */
const COLORFULNESS_WEIGHT = 1;
/** Full adapt still keeps half of the picture: reply bubbles carry the rest of readability. */
const MAX_REDUCTION = 0.5;
/** Barely loud pictures barely change; the adjustment builds as they get louder. */
const CURVE = 1.5;

export type BackgroundLook = Pick<CustomBackgroundRecord, "opacity" | "fade">;

/** How much a picture competes with text under the theme, 0 to 1. */
export function pictureLoudness(tone: PictureTone, appearance: ThemeAppearance): number {
  const towardText = appearance === "dark" ? tone.lightness : 1 - tone.lightness;
  return Math.min(1, towardText + COLORFULNESS_WEIGHT * tone.colorfulness);
}

/**
 * Lowers the picture's opacity and raises its fade by how loud it is behind
 * text, scaled by `brightnessAdapt`. Under a light theme the dark pictures are
 * the ones that compete with the text.
 */
export function adaptToBrightness({
  opacity,
  fade,
  brightnessAdapt,
  tone,
  appearance,
}: Pick<CustomBackgroundRecord, "opacity" | "fade" | "brightnessAdapt"> & {
  tone: PictureTone;
  appearance: ThemeAppearance;
}): BackgroundLook {
  const loudness = pictureLoudness(tone, appearance);
  const excess = Math.min(1, Math.max(0, (loudness - NEUTRAL_LOUDNESS) / (1 - NEUTRAL_LOUDNESS)));
  const reduction = (brightnessAdapt / 100) * MAX_REDUCTION * excess ** CURVE;
  return {
    opacity: Math.round(opacity * (1 - reduction)),
    fade: Math.round(fade + (100 - fade) * reduction),
  };
}
