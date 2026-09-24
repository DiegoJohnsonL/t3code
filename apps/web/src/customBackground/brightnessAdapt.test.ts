import { describe, expect, it } from "vite-plus/test";

import { adaptToBrightness } from "./brightnessAdapt";

const chosen = { opacity: 75, fade: 60 };

describe("adaptToBrightness", () => {
  it("keeps the chosen look when adapt is off", () => {
    expect(
      adaptToBrightness({ ...chosen, brightnessAdapt: 0, lightness: 0.9, appearance: "dark" }),
    ).toEqual(chosen);
  });

  it("leaves dark pictures alone under a dark theme", () => {
    expect(
      adaptToBrightness({ ...chosen, brightnessAdapt: 100, lightness: 0.2, appearance: "dark" }),
    ).toEqual(chosen);
  });

  it("dims a bright picture under a dark theme", () => {
    expect(
      adaptToBrightness({ ...chosen, brightnessAdapt: 40, lightness: 0.65, appearance: "dark" }),
    ).toEqual({ opacity: 59, fade: 69 });
  });

  it("dims a dark picture under a light theme instead of a bright one", () => {
    expect(
      adaptToBrightness({ ...chosen, brightnessAdapt: 40, lightness: 0.35, appearance: "light" }),
    ).toEqual({ opacity: 59, fade: 69 });
    expect(
      adaptToBrightness({ ...chosen, brightnessAdapt: 40, lightness: 0.9, appearance: "light" }),
    ).toEqual(chosen);
  });

  it("hides the picture behind a full fade at full strength on a white picture", () => {
    expect(
      adaptToBrightness({ ...chosen, brightnessAdapt: 100, lightness: 1, appearance: "dark" }),
    ).toEqual({ opacity: 0, fade: 100 });
  });
});
