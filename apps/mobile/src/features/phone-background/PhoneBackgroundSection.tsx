import { useAtomSet } from "@effect/atom-react";
import type { CustomBackgroundImageId } from "@t3tools/contracts";
import { Image } from "expo-image";
import { useState } from "react";
import { Alert, Pressable, ScrollView } from "react-native";

import { updateMobilePreferencesAtom } from "../../state/preferences";
import { SettingsActionRow } from "../settings/components/SettingsActionRow";
import { SettingsSection } from "../settings/components/SettingsSection";
import { SettingsSwitchRow } from "../settings/components/SettingsSwitchRow";
import { usePhoneBackground, usePhoneBackgroundEnabled } from "./phoneBackground";
import {
  phoneBackgroundWithoutPicture,
  phoneBackgroundWithPictures,
} from "./phoneBackground.logic";
import { deletePhonePicture, phonePictureFile, pickPhonePictures } from "./phonePictures";

function PictureTile(props: {
  readonly imageId: CustomBackgroundImageId;
  readonly disabled: boolean;
  readonly onRemove: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Remove picture"
      disabled={props.disabled}
      onPress={props.onRemove}
      className="h-32 w-[72px] overflow-hidden rounded-2xl bg-subtle"
    >
      <Image
        source={{ uri: phonePictureFile(props.imageId).uri }}
        style={{ flex: 1 }}
        contentFit="cover"
      />
    </Pressable>
  );
}

/**
 * The phone's own wallpaper for home and threads. Pictures come from the
 * phone's photo library and stay on this phone.
 */
export function PhoneBackgroundSection() {
  const background = usePhoneBackground();
  const enabled = usePhoneBackgroundEnabled();
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const [busy, setBusy] = useState(false);
  const imageIds =
    background?.record.source.kind === "image" ? background.record.source.imageIds : [];

  const addPictures = () => {
    setBusy(true);
    pickPhonePictures()
      .then((pictures) => {
        if (pictures.length === 0) return;
        savePreferences({
          transform: (current) => ({
            phoneBackground: phoneBackgroundWithPictures(
              current.phoneBackground ?? null,
              pictures,
              new Date().toISOString(),
            ),
          }),
        });
      })
      .catch((error: unknown) =>
        Alert.alert(
          "Could not add the photos",
          error instanceof Error ? error.message : "Something went wrong.",
        ),
      )
      .finally(() => setBusy(false));
  };
  const confirmRemove = (imageId: CustomBackgroundImageId) => {
    Alert.alert("Remove this picture?", "It is removed from this phone's background.", [
      { style: "cancel", text: "Cancel" },
      {
        style: "destructive",
        text: "Remove",
        onPress: () => {
          savePreferences({
            transform: (current) => ({
              phoneBackground: current.phoneBackground
                ? phoneBackgroundWithoutPicture(current.phoneBackground, imageId)
                : null,
            }),
          });
          deletePhonePicture(imageId);
        },
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
            subtitle={`${imageIds.length} ${imageIds.length === 1 ? "picture" : "pictures"}`}
            value={enabled}
            onValueChange={(phoneBackgroundEnabled) => savePreferences({ phoneBackgroundEnabled })}
          />
          <SettingsSwitchRow
            icon="paintbrush"
            label="Colors from pictures"
            value={background.dynamicTheme}
            onValueChange={(dynamicTheme) =>
              savePreferences({
                transform: (current) => ({
                  phoneBackground: current.phoneBackground
                    ? { ...current.phoneBackground, dynamicTheme }
                    : null,
                }),
              })
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
        label={busy ? "Adding photos…" : "Add photos"}
        loading={busy}
        disabled={busy}
        onPress={addPictures}
      />
    </SettingsSection>
  );
}
