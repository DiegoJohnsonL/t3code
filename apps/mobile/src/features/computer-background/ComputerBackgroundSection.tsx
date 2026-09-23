import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { AssetResource, CustomBackgroundImageId, EnvironmentId } from "@t3tools/contracts";
import { Image } from "expo-image";
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView } from "react-native";

import { updateMobilePreferencesAtom } from "../../state/preferences";
import { useAssetUrl } from "../../state/assets";
import { environmentServerConfigsAtom } from "../../state/server";
import { SettingsActionRow } from "../settings/components/SettingsActionRow";
import { SettingsSection } from "../settings/components/SettingsSection";
import { SettingsSwitchRow } from "../settings/components/SettingsSwitchRow";
import { useComputerBackgroundEnabled, usePublishedComputerBackground } from "./computerBackground";
import { addPhonePictures, removePhonePicture, setPhoneImageColors } from "./phonePictures";

function PictureTile(props: {
  readonly environmentId: EnvironmentId;
  readonly imageId: CustomBackgroundImageId;
  readonly disabled: boolean;
  readonly onRemove: () => void;
}) {
  const resource = useMemo<AssetResource>(
    () => ({ _tag: "phone-background-image", imageId: props.imageId }),
    [props.imageId],
  );
  const url = useAssetUrl(props.environmentId, resource);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Remove picture"
      disabled={props.disabled}
      onPress={props.onRemove}
      className="h-32 w-[72px] overflow-hidden rounded-2xl bg-subtle"
    >
      {url ? (
        <Image
          source={{ uri: url, cacheKey: `computer-background:${props.imageId}` }}
          style={{ flex: 1 }}
          contentFit="cover"
        />
      ) : null}
    </Pressable>
  );
}

/**
 * The shared background kept on a connected computer. Pictures added here
 * show on every phone and stay editable from the desktop; the switch at the
 * top only hides it on this phone.
 */
export function ComputerBackgroundSection() {
  const published = usePublishedComputerBackground();
  const configs = useAtomValue(environmentServerConfigsAtom);
  const enabled = useComputerBackgroundEnabled();
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const [busy, setBusy] = useState(false);
  // With no background yet, new pictures go to the first connected computer.
  const environmentId = published?.environmentId ?? configs.keys().next().value ?? null;
  if (environmentId === null) return null;

  const computerName = configs.get(environmentId)?.environment.label ?? "your computer";
  const background = published?.background ?? null;
  const imageIds =
    background?.record.source.kind === "image" ? background.record.source.imageIds : [];
  const run = (task: () => Promise<unknown>) => {
    setBusy(true);
    task()
      .catch((error: unknown) =>
        Alert.alert(
          "Could not update the background",
          error instanceof Error ? error.message : "Something went wrong.",
        ),
      )
      .finally(() => setBusy(false));
  };
  const confirmRemove = (imageId: CustomBackgroundImageId) => {
    if (background === null) return;
    Alert.alert("Remove this picture?", `It is removed from ${computerName} and every phone.`, [
      { style: "cancel", text: "Cancel" },
      {
        style: "destructive",
        text: "Remove",
        onPress: () =>
          run(() => removePhonePicture({ environmentId, current: background, imageId })),
      },
    ]);
  };

  return (
    <SettingsSection title="Background">
      {background ? (
        <>
          <SettingsSwitchRow
            icon="photo"
            label="Show behind home and threads"
            subtitle={`${background.record.name} · kept on ${computerName}`}
            value={enabled}
            onValueChange={(computerBackgroundEnabled) =>
              savePreferences({ computerBackgroundEnabled })
            }
          />
          <SettingsSwitchRow
            icon="paintbrush"
            label="Colors from pictures"
            disabled={busy}
            value={background.dynamicTheme}
            onValueChange={(dynamicTheme) =>
              run(() => setPhoneImageColors({ environmentId, current: background, dynamicTheme }))
            }
          />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerClassName="gap-2 px-4 py-3"
          >
            {imageIds.map((imageId) => (
              <PictureTile
                key={imageId}
                environmentId={environmentId}
                imageId={imageId}
                disabled={busy}
                onRemove={() => confirmRemove(imageId)}
              />
            ))}
          </ScrollView>
        </>
      ) : null}
      <SettingsActionRow
        icon="plus"
        label={busy ? "Updating background…" : `Add photos to ${computerName}`}
        loading={busy}
        disabled={busy}
        onPress={() => run(() => addPhonePictures({ environmentId, current: background }))}
      />
    </SettingsSection>
  );
}
