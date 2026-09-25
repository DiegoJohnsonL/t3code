import { describe, expect, it } from "vite-plus/test";

import { adaptToBrightness } from "./customBackgroundBrightness.js";

const chosen = { opacity: 90, fade: 0 };
const nightSky = { lightness: 0.2, colorfulness: 0.1 };
const vividRed = { lightness: 0.38, colorfulness: 0.45 };
const whitePicture = { lightness: 0.85, colorfulness: 0.1 };

const adapt = (
  tone: typeof nightSky,
  appearance: "dark" | "light" = "dark",
  brightnessAdapt = 100,
) => adaptToBrightness({ ...chosen, brightnessAdapt, tone, appearance });

describe("adaptToBrightness", () => {
  it("keeps the chosen look when adapt is off", () => {
    expect(adapt(whitePicture, "dark", 0)).toEqual(chosen);
  });

  it("barely touches a dark, muted picture under a dark theme", () => {
    expect(adapt(nightSky)).toEqual({ opacity: 89, fade: 1 });
  });

  it("calms a saturated picture even though it measures only mid lightness", () => {
    expect(adapt(vividRed)).toEqual({ opacity: 59, fade: 34 });
  });

  it("keeps at least half of a white picture at full strength", () => {
    expect(adapt(whitePicture)).toEqual({ opacity: 49, fade: 45 });
    expect(adapt({ lightness: 1, colorfulness: 1 })).toEqual({ opacity: 45, fade: 50 });
  });

  it("dims dark pictures under a light theme instead of bright ones", () => {
    expect(adapt(nightSky, "light").opacity).toBeLessThan(adapt(whitePicture, "light").opacity);
  });
});
