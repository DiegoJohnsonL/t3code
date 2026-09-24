import { useAtomSet } from "@effect/atom-react";
import { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SymbolView } from "../../components/AppSymbol";
import { AppText as Text } from "../../components/AppText";
import { updateMobilePreferencesAtom } from "../../state/preferences";
import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { SettingsSwitchRow } from "../settings/components/SettingsSwitchRow";
import {
  usePhoneBackground,
  usePhoneBackgroundEnabled,
  usePhoneBackgroundQuickAdjust,
} from "./phoneBackground";
import {
  PhoneBackgroundBubbleControls,
  PhoneBackgroundLookSliders,
} from "./PhoneBackgroundControls";

/**
 * A floating button, on while the quick adjust mode is, that opens the
 * background's look controls in a drawer over the lower half of the screen,
 * so every change shows on the home list or thread above it as it's made.
 */
export function PhoneBackgroundQuickAdjust() {
  const background = usePhoneBackground();
  const enabled = usePhoneBackgroundEnabled();
  const quickAdjust = usePhoneBackgroundQuickAdjust();
  const savePreferences = useAtomSet(updateMobilePreferencesAtom);
  const insets = useSafeAreaInsets();
  // Screen surfaces turn transparent while the background shows; the backdrop color stays solid.
  const { phoneBackdropColor } = useAppearancePreferences();
  const [open, setOpen] = useState(false);
  if (!quickAdjust || background === null) return null;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Adjust background"
        onPress={() => setOpen(true)}
        className="absolute left-3 top-[45%] size-11 items-center justify-center rounded-full bg-grouped-card/90 active:opacity-70"
      >
        <SymbolView name="slider.horizontal.3" size={20} tintColorClassName="accent-icon" />
      </Pressable>
      <Modal transparent animationType="slide" visible={open} onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityLabel="Close background controls"
          className="flex-1"
          onPress={() => setOpen(false)}
        />
        <View
          className="max-h-[55%] rounded-t-[28px]"
          style={{ paddingBottom: insets.bottom, backgroundColor: phoneBackdropColor ?? undefined }}
        >
          <View className="flex-row items-center justify-between px-5 pb-1 pt-4">
            <Text className="text-lg font-t3-medium text-foreground">Background</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setOpen(false)}
              className="rounded-full bg-subtle px-3 py-1.5 active:opacity-70"
            >
              <Text className="text-sm font-t3-medium text-foreground">Done</Text>
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <SettingsSwitchRow
              icon="photo"
              label="Show background"
              value={enabled}
              onValueChange={(phoneBackgroundEnabled) =>
                savePreferences({ phoneBackgroundEnabled })
              }
            />
            <PhoneBackgroundLookSliders record={background.record} />
            <PhoneBackgroundBubbleControls background={background} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
