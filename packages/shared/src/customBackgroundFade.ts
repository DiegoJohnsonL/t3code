import type { CustomBackgroundRecord } from "@t3tools/contracts";

/**
 * The theme-colored overlay a background draws over its picture. Desktop and
 * phone both paint these stops, so the same sliders give the same shape.
 */

export type CustomBackgroundFadeLevels = Pick<
  CustomBackgroundRecord,
  "fade" | "fadeHeight" | "fadeSoftness"
>;

export interface CustomBackgroundFadeStop {
  /** Overlay opacity, 0 to 100. */
  readonly opacity: number;
  /** Percent of the pane height, measured up from the bottom edge. */
  readonly position: number;
}

const EASE_STOPS = 8;

// An overlay only reads as darker once it hides most of the picture, so even
// steps on the intensity slider follow an ease-out opacity curve instead of
// mapping straight onto opacity: halfway already covers three quarters.
const overlayOpacity = (intensity: number) => 100 * (1 - (1 - intensity / 100) ** 2);

/**
 * The fade holds its intensity from the bottom edge, then eases away over the
 * `fadeSoftness` percent of the pane just below the fade height, so a fade
 * height of 100 eases all the way to the top, where the chat text fades out.
 */
export function customBackgroundFadeStops({
  fade,
  fadeHeight,
  fadeSoftness,
}: CustomBackgroundFadeLevels): ReadonlyArray<CustomBackgroundFadeStop> {
  // The ease cannot start below the bottom edge, and one percent is the
  // shortest span, which reads as a crisp edge.
  const span = Math.max(1, Math.min(fadeSoftness, fadeHeight));
  const easeStart = fadeHeight - span;
  const intensityAt = (position: number) => {
    const t = Math.min(1, Math.max(0, (position - easeStart) / span));
    return fade * (1 - t * t * (3 - 2 * t));
  };
  const easePositions = Array.from({ length: EASE_STOPS + 1 }, (_, index) =>
    Math.max(0, easeStart + (span * index) / EASE_STOPS),
  );
  return [0, ...easePositions, 100].map((position) => ({
    opacity: overlayOpacity(intensityAt(position)),
    position,
  }));
}
