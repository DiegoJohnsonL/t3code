import type { CustomBackgroundRecord } from "@t3tools/contracts";
import { create } from "zustand";

import { useSidebarPanelStore } from "~/components/sidebar/sidebarPanelStore";
import { useThemeEditorStore } from "~/components/settings/themeEditorStore";

type BackgroundStudioStore = {
  preview: CustomBackgroundRecord | null;
  setPreview: (record: CustomBackgroundRecord | null) => void;
};

/**
 * The record being edited, live, before it is persisted. Whether the studio is
 * open lives in the sidebar panel store, since the studio is one of the panels
 * competing for that slot.
 */
export const useBackgroundStudioStore = create<BackgroundStudioStore>((set) => ({
  preview: null,
  setPreview: (preview) => set({ preview }),
}));

export function useBackgroundStudioOpen(): boolean {
  return useSidebarPanelStore((store) => store.panel === "background");
}

export function openBackgroundStudio(): void {
  useThemeEditorStore.getState().closeThemeEditor();
  useSidebarPanelStore.getState().openSidebarPanel("background");
}

export function closeBackgroundStudio(): void {
  const { panel, closeSidebarPanel } = useSidebarPanelStore.getState();
  if (panel === "background") closeSidebarPanel();
}

export function toggleBackgroundStudio(): void {
  if (useSidebarPanelStore.getState().panel === "background") closeBackgroundStudio();
  else openBackgroundStudio();
}
