import {
  type CustomBackgroundRecord,
  MAX_CUSTOM_BACKGROUND_BLUR,
  MAX_CUSTOM_BACKGROUND_FADE,
  MIN_CUSTOM_BACKGROUND_FADE,
  type PhoneBackground,
} from "@t3tools/contracts";
import type { ComponentProps } from "react";

import type { SymbolView } from "../../components/AppSymbol";
import { FontSizeSliderRow as SliderRow } from "../settings/appearance/components/FontSizeSliderRow";
import { SettingsSwitchRow } from "../settings/components/SettingsSwitchRow";
import { useUpdatePhoneBackground } from "./phoneBackground";

// Material draws a tick per step, so percentages move in fives.
const PERCENT_STEP = 5;

const LOOK_SLIDERS = [
  { key: "fade", label: "Bottom fade", icon: "slider.horizontal.3" },
  { key: "fadeHeight", label: "Fade height", icon: "arrow.up" },
  { key: "fadeSoftness", label: "Fade softness", icon: "circle" },
  { key: "opacity", label: "Picture opacity", icon: "eye" },
] as const satisfies ReadonlyArray<{
  key: keyof CustomBackgroundRecord;
  label: string;
  icon: ComponentProps<typeof SymbolView>["name"];
}>;

export function PhoneBackgroundLookSliders(props: { readonly record: CustomBackgroundRecord }) {
  const update = useUpdatePhoneBackground();
  const setRecord = (change: Partial<CustomBackgroundRecord>) =>
    update((background) => ({ ...background, record: { ...background.record, ...change } }));
  return (
    <>
      {LOOK_SLIDERS.map(({ key, label, icon }) => (
        <SliderRow
          key={key}
          icon={icon}
          label={label}
          min={MIN_CUSTOM_BACKGROUND_FADE}
          max={MAX_CUSTOM_BACKGROUND_FADE}
          step={PERCENT_STEP}
          value={props.record[key]}
          valueLabel={`${props.record[key]}%`}
          onChange={(value) => setRecord({ [key]: value })}
        />
      ))}
      <SliderRow
        icon="circle"
        label="Background blur"
        min={0}
        max={MAX_CUSTOM_BACKGROUND_BLUR}
        step={2}
        value={props.record.blur}
        valueLabel={`${props.record.blur} px`}
        onChange={(blur) => setRecord({ blur })}
      />
    </>
  );
}

export function PhoneBackgroundBubbleControls(props: { readonly background: PhoneBackground }) {
  const update = useUpdatePhoneBackground();
  return (
    <>
      <SettingsSwitchRow
        icon="text.bubble"
        label="Bubbles behind agent replies"
        subtitle="Keeps replies readable over bright pictures."
        value={props.background.agentBubbles}
        onValueChange={(agentBubbles) => update((background) => ({ ...background, agentBubbles }))}
      />
      {props.background.agentBubbles ? (
        <SliderRow
          icon="sun.max"
          label="Bubble opacity"
          min={0}
          max={100}
          step={PERCENT_STEP}
          value={props.background.agentBubbleOpacity}
          valueLabel={`${props.background.agentBubbleOpacity}%`}
          onChange={(agentBubbleOpacity) =>
            update((background) => ({ ...background, agentBubbleOpacity }))
          }
        />
      ) : null}
    </>
  );
}
