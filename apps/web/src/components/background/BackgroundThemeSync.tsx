import {
  useBackgroundStudioOpen,
  useBackgroundStudioStore,
} from "~/customBackground/backgroundStudioStore";
import { useBackgroundImageSourceColor } from "~/customBackground/imageStore";
import {
  currentBackgroundImageId,
  resolveActiveBackground,
  upcomingBackgroundImageId,
} from "~/customBackground/records";
import { useRotationClock } from "~/customBackground/useRotationClock";
import { useRotationOffsetStore } from "~/customBackground/rotationOffsetStore";
import { useActiveBackground } from "~/customBackground/useActiveBackground";
import { useDynamicBackgroundTheme } from "~/customBackground/useDynamicBackgroundTheme";
import { useClientSettings } from "~/hooks/useSettings";

const NO_SOURCE = { kind: "none" } as const;

/**
 * Keeps the image-colors theme applied on every route. The picture itself only
 * draws behind chats, but the palette it seeds stays put in settings and the
 * rest of the app, the way a phone keeps its wallpaper colors on every screen.
 * Image slots come from the wall clock, so this agrees with the chat backdrop
 * on which picture is current without sharing a timer.
 */
export function BackgroundThemeSync() {
  const selected = useActiveBackground();
  const enabled = useClientSettings((settings) => settings.customBackgroundEnabled);
  const dynamicTheme = useClientSettings((settings) => settings.customBackgroundDynamicTheme);
  const editing = useBackgroundStudioOpen();
  const preview = useBackgroundStudioStore((store) => store.preview);
  const record = dynamicTheme
    ? resolveActiveBackground({ selected, preview, enabled, editing })
    : null;
  const source = record?.source ?? NO_SOURCE;
  const now = useRotationClock(source);
  const offset = useRotationOffsetStore((store) => store.offset);
  useDynamicBackgroundTheme(currentBackgroundImageId(source, now, offset));
  // Warm the next picture's colors so the theme switches in the same frame as
  // the picture, which CustomBackground preloads the same way.
  useBackgroundImageSourceColor(upcomingBackgroundImageId(source, now, offset));
  return null;
}
