import type { CustomBackgroundSource } from "@t3tools/contracts";
import { useEffect } from "react";
import { create } from "zustand";

import {
  currentBackgroundImageId,
  nextBackgroundRotationAt,
  upcomingBackgroundImageId,
} from "./records";

/**
 * The one rotation clock behind every rotating background, so the chat
 * backdrop and the image-colors theme cannot disagree on which picture is
 * current. `offset` counts manual next/previous steps. Both live in memory
 * only: a reload lands back on the wall clock like every other window.
 */
const useRotationStore = create<{ now: number; offset: number }>(() => ({
  now: Date.now(),
  offset: 0,
}));

export function stepBackgroundImage(delta: 1 | -1): void {
  useRotationStore.setState((state) => ({ offset: state.offset + delta }));
}

/** The picture a source shows now, and the next one so it can load before the switch. */
export function useRotatingBackgroundImage(source: CustomBackgroundSource) {
  const now = useRotationStore((state) => state.now);
  const offset = useRotationStore((state) => state.offset);
  const wakeAt = nextBackgroundRotationAt(source, now);
  useEffect(() => {
    if (wakeAt === null) return;
    // Timers run on the monotonic clock while slots follow Date.now(), and the
    // two drift apart, so a timer can land a few ms before the boundary.
    // Stepping onto the boundary regardless is what moves wakeAt and re-arms.
    const timer = setTimeout(
      () => useRotationStore.setState({ now: Math.max(Date.now(), wakeAt) }),
      Math.max(0, wakeAt - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [wakeAt]);
  return {
    current: currentBackgroundImageId(source, now, offset),
    upcoming: upcomingBackgroundImageId(source, now, offset),
  };
}
