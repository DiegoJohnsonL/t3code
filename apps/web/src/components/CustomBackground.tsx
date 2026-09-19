import { lazy, memo, Suspense, useState } from "react";

import { useBackgroundStudioStore } from "~/customBackground/backgroundStudioStore";
import { useClientSettings } from "~/hooks/useSettings";
import { useBackgroundImageUrl } from "~/customBackground/imageStore";
import {
  type CustomBackgroundRouteKind,
  backgroundIsRenderable,
  currentBackgroundImageId,
  resolveDisplayedBackground,
  upcomingBackgroundImageId,
} from "~/customBackground/records";
import { useRotationClock } from "~/customBackground/useRotationClock";
import { useRotationOffsetStore } from "~/customBackground/rotationOffsetStore";
import { useActiveBackground } from "~/customBackground/useActiveBackground";
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
  const inConversations = useClientSettings((settings) => settings.customBackgroundInConversations);
  const selected = useActiveBackground();
  const enabled = useClientSettings((settings) => settings.customBackgroundEnabled);
  const editing = useBackgroundStudioStore((store) => store.open);
  const preview = useBackgroundStudioStore((store) => store.preview);
  const record = resolveDisplayedBackground({
    selected,
    preview,
    enabled,
    editing,
    routeKind,
    inConversations,
  });
  const filtersAvailable = isWebGlAvailable();
  const source = record?.source ?? ({ kind: "none" } as const);
  const now = useRotationClock(source);
  const offset = useRotationOffsetStore((store) => store.offset);
  const imageId = currentBackgroundImageId(source, now, offset);
  const image = useBackgroundImageUrl(imageId);
  useBackgroundImageUrl(upcomingBackgroundImageId(source, now, offset));
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
          fade={{
            fade: record.fade,
            dim: record.dim,
            fadeHeight: record.fadeHeight,
            fadeSolid: record.fadeSolid,
          }}
          filtersAvailable={filtersAvailable}
        />
      </Suspense>
    </div>
  );
});
