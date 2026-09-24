import type { ReactNode } from "react";
import { View } from "react-native";

import { useAppearancePreferences } from "../settings/appearance/AppearancePreferencesProvider";
import { MarkdownImageAvailableWidthContext } from "../threads/ThreadMarkdownImage";
import { useShownPhoneBackground } from "./phoneBackground";
import { withOpacity } from "./phoneBackground.logic";

// Matches the user bubble's px-3.5 on the mobile 14px rem.
const BUBBLE_PADDING = 3.5 * 3.5;

/**
 * Sets an agent reply on a translucent bubble in the theme's backdrop color
 * while the phone background shows, so text stays readable over bright
 * pictures. Without a background it only provides the reply's image width.
 */
export function PhoneReplyBubble(props: {
  readonly contentWidth: number;
  readonly children: ReactNode;
}) {
  const background = useShownPhoneBackground();
  const { phoneBackdropColor } = useAppearancePreferences();
  if (!background?.agentBubbles || phoneBackdropColor === null) {
    return (
      <MarkdownImageAvailableWidthContext value={props.contentWidth}>
        {props.children}
      </MarkdownImageAvailableWidthContext>
    );
  }
  return (
    <View
      className="rounded-[20px] py-2.5"
      style={{
        paddingHorizontal: BUBBLE_PADDING,
        backgroundColor: withOpacity(phoneBackdropColor, background.agentBubbleOpacity),
      }}
    >
      <MarkdownImageAvailableWidthContext value={props.contentWidth - BUBBLE_PADDING * 2}>
        {props.children}
      </MarkdownImageAvailableWidthContext>
    </View>
  );
}
