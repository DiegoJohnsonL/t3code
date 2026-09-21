import type { CustomBackgroundImageId } from "@t3tools/contracts";
import { useEffect, useRef, useState } from "react";

import { useTheme } from "~/hooks/useTheme";
import { setDynamicTheme } from "~/themePalette";

import { backgroundTheme } from "./dynamicTheme";
import { useBackgroundImageSourceColor } from "./imageStore";

type RefreshTheme = ReturnType<typeof useTheme>["refreshTheme"];

/**
 * Crossfades the whole interface from the old palette to the new one as two
 * composited snapshots, timed in index.css to match the picture fade. The
 * repaint must not suppress transitions: that would cancel the picture fade
 * that started in the same commit.
 */
function repaintWithCrossfade(refreshTheme: RefreshTheme): void {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reducedMotion || !("startViewTransition" in document)) {
    refreshTheme({ suppressTransitions: reducedMotion });
    return;
  }
  document.startViewTransition(() => refreshTheme({ suppressTransitions: false }));
}

/**
 * Repaints the interface from the picture currently on screen, the way Android
 * repaints itself from a wallpaper. Pass null to hand the selected theme back.
 */
export function useDynamicBackgroundTheme(imageId: CustomBackgroundImageId | null): void {
  const { refreshTheme, resolvedTheme } = useTheme();
  const loadedColor = useBackgroundImageSourceColor(imageId);
  // Hold the previous picture's colors while the next one loads so a switch
  // never flashes the selected theme between pictures.
  const [sourceColor, setSourceColor] = useState<number | false>(false);
  if (loadedColor !== null && loadedColor !== sourceColor) setSourceColor(loadedColor);
  const wearingDynamicTheme = useRef(false);

  useEffect(() => {
    if (sourceColor === false && !wearingDynamicTheme.current) return;
    wearingDynamicTheme.current = sourceColor !== false;
    setDynamicTheme(sourceColor === false ? null : backgroundTheme(sourceColor, resolvedTheme));
    repaintWithCrossfade(refreshTheme);
  }, [refreshTheme, resolvedTheme, sourceColor]);

  useEffect(
    () => () => {
      setDynamicTheme(null);
      refreshTheme();
    },
    [refreshTheme],
  );
}
