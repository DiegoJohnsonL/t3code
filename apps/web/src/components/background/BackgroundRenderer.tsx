import { ImageDithering } from "@paper-design/shaders-react";
import type { CustomBackgroundFilter, CustomBackgroundTransition } from "@t3tools/contracts";
import {
  type CustomBackgroundFadeLevels,
  customBackgroundFadeStops,
} from "@t3tools/shared/customBackgroundFade";
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

const themeOverlay = (opacity: number) =>
  `color-mix(in srgb, var(--background) ${Math.round(opacity)}%, transparent)`;

function fadeOverlayGradient(fade: CustomBackgroundFadeLevels): string {
  const stops = customBackgroundFadeStops(fade).map(
    ({ opacity, position }) => `${themeOverlay(opacity)} ${Math.round(position)}%`,
  );
  return `linear-gradient(to top, ${stops.join(", ")})`;
}

const TRANSITION_MS = 1400;

interface SlideLook {
  /** Picture opacity, 0 to 100; the theme background shows through the rest. */
  opacity: number;
  fade: CustomBackgroundFadeLevels;
}

interface Slide {
  key: number;
  image: string | null;
  leaving: boolean;
  look: SlideLook;
}

const sameLook = (a: SlideLook, b: SlideLook) =>
  a.opacity === b.opacity &&
  a.fade.fade === b.fade.fade &&
  a.fade.fadeHeight === b.fade.fadeHeight &&
  a.fade.fadeSoftness === b.fade.fadeSoftness;

/**
 * The outgoing picture stays on top and animates out over the incoming one,
 * so a shader canvas that is still decoding its texture never shows through.
 * Each slide keeps the look it had, so a picture that brightness adapt dims
 * differently from the next one crossfades instead of jumping.
 */
function useSlides(
  image: string | null,
  look: SlideLook,
  transition: CustomBackgroundTransition,
): Slide[] {
  const [slides, setSlides] = useState<Slide[]>(() => [{ key: 0, image, leaving: false, look }]);
  const current = slides.find((slide) => !slide.leaving);
  if (current && current.image !== image) {
    const key = current.key + 1;
    setSlides(
      transition === "cut"
        ? [{ key, image, leaving: false, look }]
        : [
            ...slides.map((slide) => ({ ...slide, leaving: true })),
            { key, image, leaving: false, look },
          ],
    );
  } else if (current && !sameLook(current.look, look)) {
    setSlides(slides.map((slide) => (slide === current ? { ...slide, look } : slide)));
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
  fade: CustomBackgroundFadeLevels;
  /** Picture opacity, 0 to 100; the theme background shows through the rest. */
  opacity: number;
  /** Picture blur in pixels; 0 applies no filter. */
  blur: number;
  /** When false, skip Paper entirely and draw the photo if one is loaded. */
  filtersAvailable: boolean;
}

export const BackgroundRenderer = memo(function BackgroundRenderer({
  filter,
  image,
  transition,
  fade,
  opacity,
  blur,
  filtersAvailable,
}: BackgroundRendererProps) {
  const mode = backgroundDrawMode({
    filter,
    hasImage: typeof image === "string",
    filtersAvailable,
  });
  const slides = useSlides(image, { opacity, fade }, transition);
  if (mode === "none") return null;
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* A blurred layer fades out at its edges, so it overhangs the clipped pane by the radius. */}
      <div
        className="absolute inset-0"
        style={blur === 0 ? undefined : { filter: `blur(${blur}px)`, inset: -blur }}
      >
        {/* Each slide paints the theme background under its picture and fade,
            so two slides crossfade cleanly instead of stacking their dimming. */}
        {slides.map((slide) => (
          <div
            key={slide.key}
            className="custom-background-slide absolute inset-0 bg-background surface-grain"
            data-transition={transition}
            data-leaving={slide.leaving || undefined}
          >
            <div className="absolute inset-0" style={{ opacity: slide.look.opacity / 100 }}>
              {mode === "image" && typeof slide.image === "string" ? (
                <img src={slide.image} alt="" className="absolute size-full object-cover" />
              ) : (
                <ShaderLayer filter={filter} image={slide.image} />
              )}
            </div>
            <div
              className="absolute inset-0"
              style={{ background: fadeOverlayGradient(slide.look.fade) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
});
