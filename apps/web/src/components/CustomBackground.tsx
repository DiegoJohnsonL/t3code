import { lazy, memo, Suspense, useState } from "react";

import {
  useBackgroundStudioOpen,
  useBackgroundStudioStore,
} from "~/customBackground/backgroundStudioStore";
import { useClientSettings } from "~/hooks/useSettings";
import { useBackgroundImageUrl } from "~/customBackground/imageStore";
import {
  type CustomBackgroundRouteKind,
  backgroundDrawMode,
  backgroundIsRenderable,
  currentBackgroundImageId,
  resolveDisplayedBackground,
  upcomingBackgroundImageId,
} from "~/customBackground/records";
import { useRotationClock } from "~/customBackground/useRotationClock";
import { useRotationOffsetStore } from "~/customBackground/rotationOffsetStore";
import { useActiveBackground } from "~/customBackground/useActiveBackground";
import { useDynamicBackgroundTheme } from "~/customBackground/useDynamicBackgroundTheme";
import { isWebGlAvailable } from "~/customBackground/webgl";

// The shader library only loads once a client actually has a background
// selected, so clients on the plain theme never pay for it at startup.
const BackgroundRenderer = lazy(() =>
  import("./background/BackgroundRenderer").then((module) => ({
    default: module.BackgroundRenderer,
  })),
);

export const CustomBackground = memo(function CustomBackground({
  routeKind,
}: {
  routeKind: CustomBackgroundRouteKind;
}) {
  const selected = useActiveBackground();
  const enabled = useClientSettings((settings) => settings.customBackgroundEnabled);
  const dynamicTheme = useClientSettings((settings) => settings.customBackgroundDynamicTheme);
  const editing = useBackgroundStudioOpen();
  const preview = useBackgroundStudioStore((store) => store.preview);
  const record = resolveDisplayedBackground({
    selected,
    preview,
    enabled,
    editing,
    routeKind,
  });
  const filtersAvailable = isWebGlAvailable();
  const source = record?.source ?? ({ kind: "none" } as const);
  const now = useRotationClock(source);
  const offset = useRotationOffsetStore((store) => store.offset);
  const imageId = currentBackgroundImageId(source, now, offset);
  // Only the plain <img> path can show 4K pixels; the shader draws a fraction
  // of them and uploads whatever it is given as a full-size GPU texture.
  const variant =
    record !== null &&
    backgroundDrawMode({ filter: record.filter, hasImage: true, filtersAvailable }) === "shader"
      ? "shader"
      : "full";
  const image = useBackgroundImageUrl(imageId, variant);
  useBackgroundImageUrl(upcomingBackgroundImageId(source, now, offset), variant);
  useDynamicBackgroundTheme(dynamicTheme ? imageId : null);
  // Hold the previous picture while the next one decodes so a rotation never
  // flashes the bare theme between images.
  const [lastImage, setLastImage] = useState<string | null>(null);
  if (typeof image === "string" && image !== lastImage) setLastImage(image);
  const shownImage = typeof image === "string" ? image : image === null ? lastImage : null;
  if (!record || !backgroundIsRenderable(record, filtersAvailable)) return null;
  if (imageId !== null && shownImage === null) return null;
  return (
    <div data-chat-backdrop="source" className="pointer-events-none absolute inset-0 -z-10">
      <Suspense fallback={null}>
        <BackgroundRenderer
          filter={record.filter}
          image={shownImage}
          transition={source.kind === "image" ? source.transition : "cut"}
          fade={{ fade: record.fade, fadeHeight: record.fadeHeight, dim: record.dim }}
          opacity={record.opacity}
          filtersAvailable={filtersAvailable}
        />
      </Suspense>
    </div>
  );
});
