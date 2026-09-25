import { PhoneBackground } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";

import { getMobileThemeRuntimeVariables } from "../../lib/mobileThemeVariables";
import {
  fadeOverlayGradient,
  phoneBackgroundThemeVariables,
  phoneBackgroundWithoutPicture,
  phoneBackgroundWithPictures,
  sourceColorFromPixels,
} from "./phoneBackground.logic";

const decodePhoneBackground = Schema.decodeUnknownSync(PhoneBackground);

const background: PhoneBackground = {
  record: {
    id: "phone",
    name: "Phone",
    source: {
      kind: "image",
      imageIds: ["a".repeat(64)],
      rotationMinutes: 10,
      order: "sequential",
      transition: "fade",
    },
    filter: { kind: "none" },
    fade: 83,
    fadeHeight: 76,
    fadeSoftness: 30,
    opacity: 75,
    blur: 0,
    brightnessAdapt: 0,
    createdAt: "2026-09-22T00:00:00.000Z",
  },
  dynamicTheme: true,
  sourceColors: {},
  agentBubbles: true,
  agentBubbleOpacity: 82,
};

describe("phoneBackgroundThemeVariables", () => {
  const base = getMobileThemeRuntimeVariables("t3-code", "dark", "android");

  it("clears the home and thread backdrops and keeps their color for the picture", () => {
    const result = phoneBackgroundThemeVariables({
      variables: base,
      appearance: "dark",
      sourceColor: null,
    });
    expect(result.backdropColor).toBe(base["--color-screen"]);
    expect(result.variables["--color-screen"]).toBe("#00000000");
    expect(result.variables["--color-header"]).toBe("#00000000");
    expect(result.variables["--color-thread-canvas"]).toBe("#00000000");
    expect(result.variables["--color-sheet"]).toBe(base["--color-sheet"]);
  });

  it("recolors the theme from the picture's seed", () => {
    const seeded = phoneBackgroundThemeVariables({
      variables: base,
      appearance: "dark",
      sourceColor: 0xff3366cc,
    });
    expect(seeded.variables["--color-primary"]).not.toBe(base["--color-primary"]);
    expect(seeded.backdropColor).not.toBe(base["--color-screen"]);
    expect(seeded.variables["--color-screen"]).toBe("#00000000");
  });
});

describe("fadeOverlayGradient", () => {
  it("runs from the fade at the bottom to clear at the fade height", () => {
    const gradient = fadeOverlayGradient("#112233FF", {
      fade: 100,
      fadeHeight: 60,
      fadeSoftness: 30,
    });
    expect(gradient.startsWith("linear-gradient(to top, #112233ff 0%")).toBe(true);
    expect(gradient).toContain("#11223300 60%");
    expect(gradient.endsWith("#11223300 100%)")).toBe(true);
  });

  it("follows the desktop's intensity curve", () => {
    const gradient = fadeOverlayGradient("#112233FF", {
      fade: 50,
      fadeHeight: 100,
      fadeSoftness: 100,
    });
    expect(gradient.startsWith("linear-gradient(to top, #112233bf 0%")).toBe(true);
  });
});

describe("editing the shared phone playlist", () => {
  const first = "1".repeat(64);
  const second = "2".repeat(64);

  it("starts a playlist from the first photos a phone adds", () => {
    const started = phoneBackgroundWithPictures(
      null,
      [
        { imageId: first, sourceColor: 7 },
        { imageId: second, sourceColor: null },
      ],
      "2026-09-23T00:00:00.000Z",
    );
    expect(started.record.source).toMatchObject({ kind: "image", imageIds: [first, second] });
    expect(started.sourceColors).toEqual({ [first]: 7 });
    expect(started.dynamicTheme).toBe(true);
    expect(started.record).toMatchObject({
      fade: 55,
      fadeHeight: 100,
      fadeSoftness: 65,
      opacity: 20,
      blur: 0,
    });
    expect(started.agentBubbles).toBe(false);
  });

  it("appends new photos without duplicating ones already in the playlist", () => {
    const next = phoneBackgroundWithPictures(
      background,
      [
        { imageId: "a".repeat(64), sourceColor: 1 },
        { imageId: second, sourceColor: 2 },
      ],
      "2026-09-23T00:00:00.000Z",
    );
    expect(next.record.source).toMatchObject({ imageIds: ["a".repeat(64), second] });
    expect(next.record.name).toBe("Phone");
  });

  it("removes a photo and clears the background with the last one", () => {
    const two = phoneBackgroundWithPictures(
      background,
      [{ imageId: second, sourceColor: 2 }],
      "2026-09-23T00:00:00.000Z",
    );
    const one = phoneBackgroundWithoutPicture(two, second);
    expect(one?.record.source).toMatchObject({ imageIds: ["a".repeat(64)] });
    expect(one?.sourceColors).toEqual({});
    expect(phoneBackgroundWithoutPicture(one!, "a".repeat(64))).toBeNull();
  });

  it("scores a seed only from opaque pixels", () => {
    const orange = [255, 120, 0, 255];
    expect(sourceColorFromPixels(Uint8Array.from([...orange, ...orange]))).not.toBeNull();
    expect(sourceColorFromPixels(Uint8Array.from([255, 120, 0, 0]))).toBeNull();
  });
});

describe("stored phone backgrounds", () => {
  it("turn reply bubbles on for backgrounds saved before bubbles existed", () => {
    const { agentBubbles: _bubbles, agentBubbleOpacity: _opacity, ...saved } = background;
    const decoded = decodePhoneBackground(saved);
    expect(decoded.agentBubbles).toBe(true);
    expect(decoded.agentBubbleOpacity).toBe(82);
  });
});
