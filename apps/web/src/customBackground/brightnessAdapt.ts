import type { CustomBackgroundRecord } from "@t3tools/contracts";

import type { ThemeAppearance } from "~/themePalette";

/**
 * How far a picture may lean toward the text color before it gets adjusted:
 * a night sky under a dark theme already reads well at the chosen values.
 */
const NEUTRAL_LIGHTNESS = 0.25;

export type BackgroundLook = Pick<CustomBackgroundRecord, "opacity" | "fade">;

/**
 * Lowers the picture's opacity and raises its fade by how far its lightness
 * leans toward the theme's text color, scaled by `brightnessAdapt`. Under a
 * light theme the dark pictures are the ones that compete with the text.
 */
export function adaptToBrightness({
  opacity,
  fade,
  brightnessAdapt,
  lightness,
  appearance,
}: Pick<CustomBackgroundRecord, "opacity" | "fade" | "brightnessAdapt"> & {
  lightness: number;
  appearance: ThemeAppearance;
}): BackgroundLook {
  const lean = appearance === "dark" ? lightness : 1 - lightness;
  const excess = Math.min(1, Math.max(0, (lean - NEUTRAL_LIGHTNESS) / (1 - NEUTRAL_LIGHTNESS)));
  const reduction = (brightnessAdapt / 100) * excess;
  return {
    opacity: Math.round(opacity * (1 - reduction)),
    fade: Math.round(fade + (100 - fade) * reduction),
  };
}
