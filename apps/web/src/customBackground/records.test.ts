import { resolveDraftHeroState } from "../components/ChatView.logic";
import { describe, expect, it } from "vite-plus/test";
import { type CustomBackgroundRecord, defaultCustomBackgroundFilter } from "@t3tools/contracts";

import {
  appendBackgroundImage,
  backgroundDrawMode,
  backgroundIsRenderable,
  createEmptyBackground,
  currentBackgroundImageId,
  filtersEqual,
  nextActiveAfterRemove,
  nextBackgroundRotationAt,
  shuffledOrder,
  nextNewBackgroundName,
  removeBackground,
  resolveDisplayedBackground,
  toggleBackgroundImage,
  upcomingBackgroundImageId,
  upsertBackground,
  withFilterKind,
} from "./records";

const imageId = "a".repeat(64);
const createdAt = "2026-09-08T00:00:00.000Z";
const sunset: CustomBackgroundRecord = {
  id: "bg-1",
  name: "Sunset",
  source: {
    kind: "image",
    imageIds: [imageId],
    rotationMinutes: 10,
    order: "sequential",
    transition: "fade",
  },
  filter: defaultCustomBackgroundFilter("image-dithering"),
  fade: 100,
  dim: 60,
  fadeHeight: 60,
  fadeSolid: 25,
  createdAt,
};
const mesh = createEmptyBackground({
  id: "bg-2",
  name: "Mesh",
  filter: defaultCustomBackgroundFilter("fluted-glass"),
  createdAt,
});

describe("nextNewBackgroundName", () => {
  it("numbers from 1 and skips names already in the library", () => {
    expect(nextNewBackgroundName([])).toBe("New Playlist 1");
    expect(nextNewBackgroundName([sunset])).toBe("New Playlist 1");
    expect(
      nextNewBackgroundName([
        { ...sunset, name: "New Playlist 1" },
        { ...mesh, name: "New Playlist 3" },
      ]),
    ).toBe("New Playlist 2");
  });
});

describe("library edits", () => {
  it("upserts by id and keeps order", () => {
    const library = upsertBackground([sunset, mesh], { ...sunset, name: "Dusk" });
    expect(library.map((record) => record.name)).toEqual(["Dusk", "Mesh"]);
    expect(upsertBackground([sunset], mesh)).toEqual([sunset, mesh]);
  });

  it("removes and clears the active pointer only when it was the removed one", () => {
    expect(removeBackground([sunset, mesh], "bg-1")).toEqual([mesh]);
    expect(nextActiveAfterRemove("bg-1", "bg-1")).toBeNull();
    expect(nextActiveAfterRemove("bg-2", "bg-1")).toBe("bg-2");
  });

  it("resets parameters when the filter kind changes and keeps the image", () => {
    const glass = withFilterKind(sunset, "fluted-glass");
    expect(glass.filter.kind).toBe("fluted-glass");
    expect(glass.source).toEqual(sunset.source);
    expect(withFilterKind(glass, "fluted-glass")).toBe(glass);
    const plain = withFilterKind(glass, "none");
    expect(plain.source).toEqual(sunset.source);
  });
});

describe("images", () => {
  it("only renders records that have an image", () => {
    expect(backgroundIsRenderable(sunset)).toBe(true);
    expect(backgroundIsRenderable(mesh)).toBe(false);
    expect(backgroundIsRenderable({ ...sunset, source: { kind: "none" } })).toBe(false);
  });

  it("draws the photo without a filter when shaders cannot run", () => {
    expect(
      backgroundDrawMode({
        filter: sunset.filter,
        hasImage: true,
        filtersAvailable: false,
      }),
    ).toBe("image");
    expect(
      backgroundDrawMode({
        filter: mesh.filter,
        hasImage: false,
        filtersAvailable: false,
      }),
    ).toBe("none");
    expect(backgroundIsRenderable(sunset, false)).toBe(true);
    expect(backgroundIsRenderable(mesh, false)).toBe(false);
  });
});

describe("filtersEqual", () => {
  it("compares kind and parameters", () => {
    const a = defaultCustomBackgroundFilter("fluted-glass");
    expect(filtersEqual(a, defaultCustomBackgroundFilter("fluted-glass"))).toBe(true);
    if (a.kind !== "fluted-glass") throw new Error("unexpected kind");
    expect(filtersEqual(a, { ...a, blur: a.blur + 0.01 })).toBe(false);
    expect(filtersEqual(a, defaultCustomBackgroundFilter("image-dithering"))).toBe(false);
  });
});

describe("live app background", () => {
  const options = {
    selected: sunset,
    preview: null,
    enabled: true,
    editing: false,
    routeKind: "other" as const,
    inConversations: false,
  };

  it("previews slider changes only on routes where backgrounds are enabled", () => {
    const preview = { ...sunset, fade: 25 };
    expect(resolveDisplayedBackground(options)).toBeNull();
    expect(resolveDisplayedBackground({ ...options, editing: true, preview })).toBeNull();
    expect(
      resolveDisplayedBackground({ ...options, editing: true, preview, routeKind: "draft" }),
    ).toBe(preview);
    expect(
      resolveDisplayedBackground({
        ...options,
        editing: true,
        preview,
        routeKind: "conversation",
        inConversations: true,
      }),
    ).toBe(preview);
    const saved = { ...options, selected: preview, preview, editing: false };
    expect(resolveDisplayedBackground(saved)).toBeNull();
    expect(resolveDisplayedBackground({ ...saved, routeKind: "draft" })).toBe(preview);
    expect(
      resolveDisplayedBackground({
        ...saved,
        routeKind: "conversation",
        inConversations: true,
      }),
    ).toBe(preview);
  });

  it("hides drafts and editor previews when disabled", () => {
    const state = {
      ...options,
      routeKind: "draft" as const,
      editing: true,
      preview: { ...sunset, fade: 25 },
    };
    expect(resolveDisplayedBackground({ ...state, enabled: false })).toBeNull();
    expect(resolveDisplayedBackground(state)).toBe(state.preview);
  });

  it("does not paint another background's pending changes after changing selection", () => {
    expect(
      resolveDisplayedBackground({
        ...options,
        routeKind: "draft",
        editing: true,
        selected: mesh,
        preview: sunset,
      }),
    ).toBe(mesh);
    expect(
      resolveDisplayedBackground({
        ...options,
        routeKind: "draft",
        editing: true,
        selected: null,
        preview: sunset,
      }),
    ).toBeNull();
  });
});

describe("background visibility during first submission", () => {
  it.each([
    { hasTimelineEntries: false, isWorking: false, draftHeroDockRequested: false, visible: true },
    { hasTimelineEntries: false, isWorking: false, draftHeroDockRequested: true, visible: false },
    { hasTimelineEntries: true, isWorking: false, draftHeroDockRequested: false, visible: false },
    { hasTimelineEntries: true, isWorking: true, draftHeroDockRequested: false, visible: false },
  ])("respects the empty chat state: %j", ({ visible, ...state }) => {
    const isDraftHeroState = resolveDraftHeroState({
      ...state,
      isLocalDraftThread: true,
      backgroundSubmissionPending: false,
    });
    for (const inConversations of [false, true]) {
      expect(
        resolveDisplayedBackground({
          selected: sunset,
          preview: null,
          enabled: true,
          editing: false,
          routeKind: isDraftHeroState ? "draft" : "conversation",
          inConversations,
        }),
      ).toBe(visible || inConversations ? sunset : null);
    }
  });
});

describe("image rotation", () => {
  const first = "1".repeat(64);
  const second = "2".repeat(64);
  const third = "3".repeat(64);
  const rotating = {
    kind: "image",
    imageIds: [first, second, third],
    rotationMinutes: 10,
    order: "sequential",
    transition: "fade",
  } as const;
  const minute = 60_000;

  it("walks the images in order on the wall clock", () => {
    expect(currentBackgroundImageId(rotating, 0)).toBe(first);
    expect(currentBackgroundImageId(rotating, 10 * minute)).toBe(second);
    expect(currentBackgroundImageId(rotating, 29 * minute)).toBe(third);
    expect(currentBackgroundImageId(rotating, 30 * minute)).toBe(first);
    expect(currentBackgroundImageId({ kind: "none" }, 0)).toBeNull();
  });

  it("knows the next image and when it lands", () => {
    expect(upcomingBackgroundImageId(rotating, 25 * minute)).toBe(first);
    expect(nextBackgroundRotationAt(rotating, 25 * minute)).toBe(30 * minute);
    const single = { ...rotating, imageIds: [first] };
    expect(upcomingBackgroundImageId(single, 0)).toBeNull();
    expect(nextBackgroundRotationAt(single, 0)).toBeNull();
  });

  it("shifts the slot by the manual offset", () => {
    expect(currentBackgroundImageId(rotating, 0, 1)).toBe(second);
    expect(currentBackgroundImageId(rotating, 0, -1)).toBe(third);
    expect(upcomingBackgroundImageId(rotating, 0, 1)).toBe(third);
  });

  it("shuffles every round as a permutation that never repeats across the boundary", () => {
    const count = 5;
    let previousLast: number | null = null;
    for (let round = 0; round < 200; round += 1) {
      const order = shuffledOrder(count, round);
      expect([...order].sort()).toEqual([0, 1, 2, 3, 4]);
      expect(order).toEqual(shuffledOrder(count, round));
      if (previousLast !== null) expect(order[0]).not.toBe(previousLast);
      previousLast = order[count - 1]!;
    }
    const shuffled = { ...rotating, order: "shuffle" } as const;
    const seen = new Set(
      [0, 1, 2].map((slot) => currentBackgroundImageId(shuffled, slot * 10 * minute)),
    );
    expect(seen.size).toBe(3);
  });

  it("toggles images in and out and drops the source when empty", () => {
    expect(toggleBackgroundImage({ kind: "none" }, first)).toEqual({
      kind: "image",
      imageIds: [first],
      rotationMinutes: 10,
      order: "sequential",
      transition: "fade",
    });
    expect(toggleBackgroundImage(rotating, second)).toEqual({
      ...rotating,
      imageIds: [first, third],
    });
    expect(toggleBackgroundImage({ ...rotating, imageIds: [first] }, first)).toEqual({
      kind: "none",
    });
    expect(appendBackgroundImage(rotating, second)).toBe(rotating);
    expect(appendBackgroundImage({ ...rotating, imageIds: [first] }, second).imageIds).toEqual([
      first,
      second,
    ]);
  });
});
