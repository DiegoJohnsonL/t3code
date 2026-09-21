import type { CustomBackgroundImageId } from "@t3tools/contracts";
import { useEffect } from "react";

import { useTheme } from "~/hooks/useTheme";
import { setDynamicTheme } from "~/themePalette";

import { backgroundTheme } from "./dynamicTheme";
import { useBackgroundImageSourceColor } from "./imageStore";

/**
 * Repaints the interface from the picture currently on screen, the way Android
 * repaints itself from a wallpaper. Pass null to hand the selected theme back.
 */
export function useDynamicBackgroundTheme(imageId: CustomBackgroundImageId | null): void {
  const { refreshTheme, resolvedTheme } = useTheme();
  const sourceColor = useBackgroundImageSourceColor(imageId);

  useEffect(() => {
    setDynamicTheme(sourceColor === null ? null : backgroundTheme(sourceColor, resolvedTheme));
    refreshTheme();
  }, [refreshTheme, resolvedTheme, sourceColor]);

  useEffect(
    () => () => {
      setDynamicTheme(null);
      refreshTheme();
    },
    [refreshTheme],
  );
}
