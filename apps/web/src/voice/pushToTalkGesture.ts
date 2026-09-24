/** Releasing sooner than this counts as a tap rather than holding to talk. */
export const PUSH_TO_TALK_HOLD_MS = 350;
/** A second tap within this window locks recording hands-free. */
export const PUSH_TO_TALK_DOUBLE_TAP_MS = 500;

export type PushToTalkActions = {
  readonly start: () => void;
  readonly stop: () => void;
  readonly cancel: () => void;
};

type GestureState =
  | { readonly kind: "idle" }
  | { readonly kind: "holding"; readonly pressedAt: number }
  | { readonly kind: "awaiting-second-tap" }
  | { readonly kind: "locked" };

/**
 * Wispr-style dictation key: hold to talk and release to transcribe, or
 * double-tap to keep recording hands-free until the next press. Recording
 * starts on the first press so the opening words are never lost; a lone tap
 * discards it.
 */
export function createPushToTalkGesture(input: {
  readonly actions: PushToTalkActions;
  readonly now: () => number;
  readonly schedule: (callback: () => void, delayMs: number) => () => void;
}) {
  let state: GestureState = { kind: "idle" };
  let cancelScheduled: (() => void) | null = null;

  const clearScheduled = () => {
    cancelScheduled?.();
    cancelScheduled = null;
  };

  return {
    press(): void {
      switch (state.kind) {
        case "idle":
          state = { kind: "holding", pressedAt: input.now() };
          input.actions.start();
          return;
        case "awaiting-second-tap":
          clearScheduled();
          state = { kind: "locked" };
          return;
        case "locked":
          state = { kind: "idle" };
          input.actions.stop();
          return;
        case "holding":
          return;
      }
    },
    release(): void {
      if (state.kind !== "holding") return;
      if (input.now() - state.pressedAt >= PUSH_TO_TALK_HOLD_MS) {
        state = { kind: "idle" };
        input.actions.stop();
        return;
      }
      state = { kind: "awaiting-second-tap" };
      cancelScheduled = input.schedule(() => {
        cancelScheduled = null;
        if (state.kind !== "awaiting-second-tap") return;
        state = { kind: "idle" };
        input.actions.cancel();
      }, PUSH_TO_TALK_DOUBLE_TAP_MS);
    },
    /** A click toggles hands-free recording. */
    toggle(): void {
      if (state.kind === "idle") {
        state = { kind: "locked" };
        input.actions.start();
        return;
      }
      clearScheduled();
      state = { kind: "idle" };
      input.actions.stop();
    },
    /** Forget the gesture after recording ends some other way (cancel, error, time limit). */
    reset(): void {
      clearScheduled();
      state = { kind: "idle" };
    },
  };
}

export type PushToTalkGesture = ReturnType<typeof createPushToTalkGesture>;
