import { DEFAULT_SERVER_SETTINGS, type PhoneBackground } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import { applyServerSettingsPatch } from "./serverSettings.ts";

function phoneBackground(imageIds: ReadonlyArray<string>): PhoneBackground {
  return {
    record: {
      id: "phone",
      name: "Phone",
      source: {
        kind: "image",
        imageIds,
        rotationMinutes: 10,
        order: "sequential",
        transition: "fade",
      },
      filter: { kind: "none" },
      fade: 83,
      fadeHeight: 76,
      fadeSoftness: 30,
      opacity: 75,
      createdAt: "2026-09-22T00:00:00.000Z",
    },
    dynamicTheme: true,
    sourceColors: Object.fromEntries(imageIds.map((imageId, index) => [imageId, index])),
  };
}

describe("phoneBackground settings", () => {
  it("replaces the published background instead of merging two playlists", () => {
    const first = applyServerSettingsPatch(DEFAULT_SERVER_SETTINGS, {
      phoneBackground: phoneBackground(["a".repeat(64), "b".repeat(64)]),
    });
    const next = phoneBackground(["c".repeat(64)]);

    expect(applyServerSettingsPatch(first, { phoneBackground: next }).phoneBackground).toEqual(
      next,
    );
    expect(applyServerSettingsPatch(first, { phoneBackground: null }).phoneBackground).toBeNull();
    expect(applyServerSettingsPatch(first, {}).phoneBackground).toEqual(first.phoneBackground);
  });
});
