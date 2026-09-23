import type { AssetResource, CustomBackgroundImageId, EnvironmentId } from "@t3tools/contracts";
import { Image } from "expo-image";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import { useAssetUrl } from "../../state/assets";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { useComputerBackgroundImage, useComputerBackgroundSource } from "./computerBackground";
import { fadeOverlayGradient } from "./computerBackground.logic";

// The desktop's slide transition length, so a rotation looks the same on both.
const FADE_TRANSITION = { duration: 1400, effect: "cross-dissolve" } as const;

function usePictureUrl(
  environmentId: EnvironmentId | null,
  imageId: CustomBackgroundImageId | null,
) {
  const resource = useMemo<AssetResource | null>(
    () => (imageId === null ? null : { _tag: "phone-background-image", imageId }),
    [imageId],
  );
  return useAssetUrl(environmentId, resource);
}

/**
 * Draws a connected computer's background behind navigation. Home and thread
 * screens clear their backdrop while it shows, so the picture fills the phone
 * the way a wallpaper does: cropped to cover, centered, under the same bottom
 * fade the desktop draws.
 */
export function ComputerBackgroundLayer() {
  const source = useComputerBackgroundSource();
  const { computerBackdropColor } = useAppearancePreferences();
  const record = source?.background.record ?? null;
  const image = useComputerBackgroundImage(record?.source ?? null);
  const url = usePictureUrl(source?.environmentId ?? null, image.current);
  if (record === null || computerBackdropColor === null) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0"
      style={{ backgroundColor: computerBackdropColor }}
    >
      {url !== null && image.current !== null ? (
        <Image
          // Signed URLs rotate; the picture itself only changes with its id.
          source={{ uri: url, cacheKey: `computer-background:${image.current}` }}
          style={[StyleSheet.absoluteFill, { opacity: record.opacity / 100 }]}
          contentFit="cover"
          contentPosition="center"
          transition={
            record.source.kind === "image" && record.source.transition === "fade"
              ? FADE_TRANSITION
              : null
          }
        />
      ) : null}
      <View
        className="absolute inset-0"
        style={{ experimental_backgroundImage: fadeOverlayGradient(computerBackdropColor, record) }}
      />
    </View>
  );
}
