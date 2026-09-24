import { MonitorCog } from "lucide-react";
import type { ReactNode } from "react";

import {
  openBackgroundStudio,
  useBackgroundStudioOpen,
  useBackgroundStudioStore,
} from "~/customBackground/backgroundStudioStore";
import { resolveActiveBackground } from "~/customBackground/records";
import { useActiveBackground } from "~/customBackground/useActiveBackground";
import { useClientSettings } from "~/hooks/useSettings";
import { Button } from "../ui/button";

/**
 * Hides the theme cards while the picture's colors repaint the app, since no
 * card choice would show. The color scheme picker above stays.
 */
export function PictureColorsThemeGate({ children }: { children: ReactNode }) {
  const selected = useActiveBackground();
  const enabled = useClientSettings((settings) => settings.customBackgroundEnabled);
  const dynamicTheme = useClientSettings((settings) => settings.customBackgroundDynamicTheme);
  const editing = useBackgroundStudioOpen();
  const preview = useBackgroundStudioStore((store) => store.preview);
  const pictureColors =
    dynamicTheme && resolveActiveBackground({ selected, preview, enabled, editing }) !== null;
  if (!pictureColors) return children;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 pt-2 sm:px-4">
      <p className="text-sm text-muted-foreground">
        Colors come from your background picture. Turn off Theme from image colors to pick a theme.
      </p>
      <Button size="xs" variant="outline" onClick={openBackgroundStudio}>
        <MonitorCog /> Customize background
      </Button>
    </div>
  );
}
