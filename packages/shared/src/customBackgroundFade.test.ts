import { describe, expect, it } from "vite-plus/test";

import { customBackgroundFadeStops } from "./customBackgroundFade.ts";

const opacityAt = (stops: ReturnType<typeof customBackgroundFadeStops>, position: number) => {
  const above = stops.findIndex((stop) => stop.position >= position);
  const upper = stops[above]!;
  const lower = stops[Math.max(0, above - 1)]!;
  if (upper.position === lower.position) return upper.opacity;
  const t = (position - lower.position) / (upper.position - lower.position);
  return lower.opacity + (upper.opacity - lower.opacity) * t;
};

describe("customBackgroundFadeStops", () => {
  it("holds the fade, then eases it away by the fade height", () => {
    const stops = customBackgroundFadeStops({ fade: 100, fadeHeight: 70, fadeSoftness: 30 });
    expect(opacityAt(stops, 0)).toBe(100);
    expect(opacityAt(stops, 40)).toBe(100);
    expect(opacityAt(stops, 55)).toBeCloseTo(75);
    expect(opacityAt(stops, 70)).toBe(0);
    expect(opacityAt(stops, 100)).toBe(0);
  });

  it("eases all the way to the top at a fade height of 100", () => {
    const stops = customBackgroundFadeStops({ fade: 100, fadeHeight: 100, fadeSoftness: 40 });
    expect(opacityAt(stops, 60)).toBe(100);
    expect(opacityAt(stops, 80)).toBeCloseTo(75);
    expect(opacityAt(stops, 100)).toBe(0);
  });

  it("starts a softness longer than the fade height at the bottom edge", () => {
    const stops = customBackgroundFadeStops({ fade: 100, fadeHeight: 40, fadeSoftness: 80 });
    expect(opacityAt(stops, 0)).toBe(100);
    expect(opacityAt(stops, 20)).toBeCloseTo(75);
    expect(opacityAt(stops, 40)).toBe(0);
  });

  it("draws a crisp edge at zero softness", () => {
    const stops = customBackgroundFadeStops({ fade: 100, fadeHeight: 50, fadeSoftness: 0 });
    expect(opacityAt(stops, 49)).toBe(100);
    expect(opacityAt(stops, 50)).toBe(0);
  });

  it("covers three quarters of the picture at half intensity", () => {
    const stops = customBackgroundFadeStops({ fade: 50, fadeHeight: 100, fadeSoftness: 0 });
    expect(opacityAt(stops, 0)).toBe(75);
  });
});
