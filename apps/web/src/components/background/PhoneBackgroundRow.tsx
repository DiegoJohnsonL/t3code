import type { CustomBackgroundRecord, UnifiedSettings } from "@t3tools/contracts";
import { useState } from "react";

import { publishPhoneBackground } from "~/customBackground/phoneBackground";
import { usePrimarySettings, useUpdatePrimarySettings } from "~/hooks/useSettings";
import { usePrimaryEnvironmentId } from "~/state/environments";
import { Button } from "../ui/button";
import { toastManager } from "../ui/toast";
import { StudioField } from "./BackgroundControls";

const selectPhoneBackground = (settings: UnifiedSettings) => settings.phoneBackground;

/**
 * Copies the selected playlist to the phones connected to this computer. The
 * copy is shared: a phone can add or remove pictures afterwards, so sending
 * again replaces whatever the phones edited.
 */
export function PhoneBackgroundRow(props: {
  readonly record: CustomBackgroundRecord | null;
  readonly dynamicTheme: boolean;
}) {
  const environmentId = usePrimaryEnvironmentId();
  const published = usePrimarySettings(selectPhoneBackground);
  const updateSettings = useUpdatePrimarySettings();
  const [busy, setBusy] = useState(false);
  // The hosted app has no computer of its own to keep a phone background on.
  if (environmentId === null) return null;

  const publish = (record: CustomBackgroundRecord | null) => {
    setBusy(true);
    void publishPhoneBackground({
      environmentId,
      record,
      dynamicTheme: props.dynamicTheme,
      publish: (phoneBackground) => updateSettings({ phoneBackground }),
    })
      .catch((error: unknown) => {
        toastManager.add({
          type: "error",
          title: "Could not update the phone background",
          description: error instanceof Error ? error.message : undefined,
        });
      })
      .finally(() => setBusy(false));
  };
  const pictureCount =
    published?.record.source.kind === "image" ? published.record.source.imageIds.length : 0;

  return (
    <StudioField label="Phones">
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
        {published
          ? `${published.record.name} · ${pictureCount} ${pictureCount === 1 ? "picture" : "pictures"}`
          : "Nothing sent"}
      </span>
      <Button
        size="xs"
        variant="outline"
        disabled={busy || props.record?.source.kind !== "image"}
        onClick={() => publish(props.record)}
      >
        Send playlist
      </Button>
      {published ? (
        <Button size="xs" variant="outline" disabled={busy} onClick={() => publish(null)}>
          Remove
        </Button>
      ) : null}
    </StudioField>
  );
}
