import { describe, expect, it } from "vite-plus/test";

import {
  currentBackgroundImageId,
  nextBackgroundRotationAt,
  shuffledOrder,
  upcomingBackgroundImageId,
} from "./customBackgroundRotation.ts";

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
});
