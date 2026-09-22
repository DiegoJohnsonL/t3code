import type { CustomBackgroundImageSource } from "@t3tools/contracts";
import { act } from "react";
import { create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";

const minute = 60_000;
const images = ["1", "2", "3"].map((digit) => digit.repeat(64));
const source: CustomBackgroundImageSource = {
  kind: "image",
  imageIds: images,
  rotationMinutes: 30,
  order: "sequential",
  transition: "fade",
};
const renderers: ReactTestRenderer[] = [];

function following(image: unknown) {
  return images[(images.findIndex((candidate) => candidate === image) + 1) % images.length];
}

// Each call is one consumer, like the chat backdrop or the theme sync.
async function mountCurrentImage() {
  const { useRotatingBackgroundImage } = await import("./rotation");
  function CurrentImage() {
    return <>{useRotatingBackgroundImage(source).current}</>;
  }
  let renderer: ReactTestRenderer | undefined;
  await act(async () => {
    renderer = create(<CurrentImage />);
  });
  renderers.push(renderer!);
  return () => renderer!.toJSON();
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000 * 30 * minute + 10 * minute);
  vi.resetModules();
});

afterEach(async () => {
  await act(async () => {
    for (const renderer of renderers.splice(0)) renderer.unmount();
  });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("keeps rotating when a timer fires a few ms before the boundary", async () => {
  const shown = await mountCurrentImage();
  const first = shown();
  // Timers keep monotonic time; the wall clock drifts 5 ms behind it.
  vi.setSystemTime(Date.now() - 5);

  await act(async () => vi.advanceTimersToNextTimer());
  expect(shown()).toBe(following(first));

  await act(async () => vi.advanceTimersToNextTimer());
  expect(shown()).toBe(following(following(first)));
});

it("shows a consumer mounted after sleep the same picture as one already running", async () => {
  const theme = await mountCurrentImage();
  const first = theme();
  // Sleep: the wall clock moves an hour while pending timers stay put.
  vi.setSystemTime(Date.now() + 60 * minute);

  const backdrop = await mountCurrentImage();
  expect(backdrop()).toBe(first);

  await act(async () => vi.advanceTimersToNextTimer());
  expect(theme()).toBe(following(following(first)));
  expect(backdrop()).toBe(theme());
});
