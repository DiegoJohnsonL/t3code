import { describe, expect, it } from "vite-plus/test";

import {
  createPushToTalkGesture,
  PUSH_TO_TALK_DOUBLE_TAP_MS,
  PUSH_TO_TALK_HOLD_MS,
} from "./pushToTalkGesture";

function setup() {
  let now = 0;
  const events: string[] = [];
  const timers: Array<{ at: number; callback: () => void; cancelled: boolean }> = [];
  const gesture = createPushToTalkGesture({
    actions: {
      start: () => events.push("start"),
      stop: () => events.push("stop"),
      cancel: () => events.push("cancel"),
    },
    now: () => now,
    schedule: (callback, delayMs) => {
      const timer = { at: now + delayMs, callback, cancelled: false };
      timers.push(timer);
      return () => {
        timer.cancelled = true;
      };
    },
  });
  const advance = (ms: number) => {
    now += ms;
    for (const timer of timers) {
      if (!timer.cancelled && timer.at <= now) {
        timer.cancelled = true;
        timer.callback();
      }
    }
  };
  return { gesture, events, advance };
}

describe("createPushToTalkGesture", () => {
  it("transcribes when a held key is released", () => {
    const { gesture, events, advance } = setup();
    gesture.press();
    advance(PUSH_TO_TALK_HOLD_MS + 200);
    gesture.release();
    expect(events).toEqual(["start", "stop"]);
  });

  it("discards a single tap", () => {
    const { gesture, events, advance } = setup();
    gesture.press();
    advance(80);
    gesture.release();
    advance(PUSH_TO_TALK_DOUBLE_TAP_MS);
    expect(events).toEqual(["start", "cancel"]);
  });

  it("locks hands-free recording on a double tap until the next press", () => {
    const { gesture, events, advance } = setup();
    gesture.press();
    advance(80);
    gesture.release();
    advance(150);
    gesture.press();
    advance(80);
    gesture.release();
    advance(10_000);
    expect(events).toEqual(["start"]);

    gesture.press();
    expect(events).toEqual(["start", "stop"]);
  });

  it("starts over after recording ends on its own", () => {
    const { gesture, events } = setup();
    gesture.toggle();
    gesture.reset();
    gesture.press();
    expect(events).toEqual(["start", "start"]);
  });
});
