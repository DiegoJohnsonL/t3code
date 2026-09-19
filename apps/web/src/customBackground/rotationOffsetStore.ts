import { create } from "zustand";

/**
 * Manual next/previous steps, applied on top of the wall-clock slot. Kept in
 * memory only: a reload lands back on the clock like every other window.
 */
export const useRotationOffsetStore = create<{ offset: number; step: (delta: number) => void }>(
  (set) => ({
    offset: 0,
    step: (delta) => set((state) => ({ offset: state.offset + delta })),
  }),
);

export function stepBackgroundImage(delta: 1 | -1): void {
  useRotationOffsetStore.getState().step(delta);
}
