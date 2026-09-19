import { ImageDithering } from "@paper-design/shaders-react";
import type { CustomBackgroundFilter, CustomBackgroundTransition } from "@t3tools/contracts";
import { memo, useEffect, useState } from "react";

import { BACKGROUND_WEBGL_CONTEXT_ATTRIBUTES } from "~/customBackground/webgl";
import { backgroundDrawMode } from "~/customBackground/records";

// Cap GPU work on high-resolution displays; the background sits under a fade.
const MAX_PIXEL_COUNT = 1920 * 1200;

const SHADER_PROPS = {
  webGlContextAttributes: BACKGROUND_WEBGL_CONTEXT_ATTRIBUTES,
  width: "100%",
  height: "100%",
  speed: 0,
  minPixelRatio: 1,
  maxPixelCount: MAX_PIXEL_COUNT,
  className: "absolute inset-0",
} as const;

function ShaderLayer({ filter, image }: { filter: CustomBackgroundFilter; image: string | null }) {
  switch (filter.kind) {
    case "none":
      return null;
    case "image-dithering": {
      if (!image) return null;
      const { kind: _kind, ...params } = filter;
      return <ImageDithering image={image} {...params} {...SHADER_PROPS} />;
    }
    default: {
      const _exhaustive: never = filter;
      return _exhaustive;
    }
  }
}

export interface BackgroundFade {
  /** Overlay strength at the bottom edge, 0 to 100. */
  fade: number;
  /** Percent of the pane the overlay climbs before it settles. */
  fadeHeight: number;
}

const FADE_STOPS = 8;
// The top of the pane keeps this share of the bottom strength, and the bottom
// share of the height holds full strength before the ramp begins. Both fixed,
// so two sliders always produce the same silhouette.
const TOP_SHARE = 0.55;
const SOLID_SHARE = 0.45;

export function fadeOverlayGradient({ fade, fadeHeight }: BackgroundFade): string {
  const stop = (opacity: number, position: number) =>
    `color-mix(in srgb, var(--background) ${Math.round(opacity)}%, transparent) ${Math.round(position)}%`;
  const top = fade * TOP_SHARE;
  const solid = fadeHeight * SOLID_SHARE;
  const stops = [stop(fade, 0)];
  for (let index = 0; index <= FADE_STOPS; index += 1) {
    const t = index / FADE_STOPS;
    const eased = t * t * (3 - 2 * t);
    stops.push(stop(fade + (top - fade) * eased, solid + t * (fadeHeight - solid)));
  }
  stops.push(stop(top, 100));
  return `linear-gradient(to top, ${stops.join(", ")})`;
}

const TRANSITION_MS = 1400;

interface Slide {
  key: number;
  image: string | null;
  leaving: boolean;
}

/**
 * The outgoing picture stays on top and animates out over the incoming one,
 * so a shader canvas that is still decoding its texture never shows through.
 */
function useSlides(image: string | null, transition: CustomBackgroundTransition): Slide[] {
  const [slides, setSlides] = useState<Slide[]>(() => [{ key: 0, image, leaving: false }]);
  const current = slides.find((slide) => !slide.leaving);
  if (current && current.image !== image) {
    const key = current.key + 1;
    setSlides(
      transition === "cut"
        ? [{ key, image, leaving: false }]
        : [...slides.map((slide) => ({ ...slide, leaving: true })), { key, image, leaving: false }],
    );
  }
  const leavingCount = slides.length - 1;
  useEffect(() => {
    if (leavingCount === 0) return;
    const timer = setTimeout(
      () => setSlides((previous) => previous.filter((slide) => !slide.leaving)),
      TRANSITION_MS,
    );
    return () => clearTimeout(timer);
  }, [leavingCount, slides]);
  return slides;
}

export interface BackgroundRendererProps {
  filter: CustomBackgroundFilter;
  /** Object URL of the source image; null while it loads. */
  image: string | null;
  transition: CustomBackgroundTransition;
  fade: BackgroundFade;
  /** Picture opacity, 0 to 100; the theme background shows through the rest. */
  opacity: number;
  /** When false, skip Paper entirely and draw the photo if one is loaded. */
  filtersAvailable: boolean;
}

export const BackgroundRenderer = memo(function BackgroundRenderer({
  filter,
  image,
  transition,
  fade,
  opacity,
  filtersAvailable,
}: BackgroundRendererProps) {
  const mode = backgroundDrawMode({
    filter,
    hasImage: typeof image === "string",
    filtersAvailable,
  });
  const slides = useSlides(image, transition);
  if (mode === "none") return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute inset-0" style={{ opacity: opacity / 100 }}>
        {slides.map((slide) => (
          <div
            key={slide.key}
            className="custom-background-slide absolute inset-0"
            data-transition={transition}
            data-leaving={slide.leaving || undefined}
          >
            {mode === "image" && typeof slide.image === "string" ? (
              <img src={slide.image} alt="" className="absolute size-full object-cover" />
            ) : (
              <ShaderLayer filter={filter} image={slide.image} />
            )}
          </div>
        ))}
      </div>
      {/* Above the slides: an outgoing slide is lifted over the incoming one and
          would otherwise escape the dimming for the length of the fade. */}
      <div className="absolute inset-0 z-[2]" style={{ background: fadeOverlayGradient(fade) }} />
    </div>
  );
});
