import type { ExecutionEnvironmentDescriptor, UnifiedSettings } from "@t3tools/contracts";
import {
  serveModeComputerName,
  WINDOWS_LID_CLOSED_SETUP,
} from "@t3tools/client-runtime/serve-mode";

import { usePrimarySettings, useUpdatePrimarySettings } from "~/hooks/useSettings";
import { Switch } from "../ui/switch";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

const selectServeMode = (settings: UnifiedSettings) => settings.serveMode;

const DESCRIPTIONS = {
  Mac: "Keep this Mac awake while T3 Code runs, so agents keep working and your phone can connect. The display still sleeps and locks. With the one-time helper from scripts/serve-mode, it also keeps running with the lid closed while plugged in and uses Low Power Mode.",
  PC: `Keep this PC awake while T3 Code runs, so agents keep working and your phone can connect. The display still sleeps and locks. ${WINDOWS_LID_CLOSED_SETUP}`,
} as const;

/** Renders nothing for servers that ignore the setting. */
export function ServeModeRow(props: {
  readonly environment: ExecutionEnvironmentDescriptor | undefined;
}) {
  const serveMode = usePrimarySettings(selectServeMode);
  const updateSettings = useUpdatePrimarySettings();
  const computer = props.environment ? serveModeComputerName(props.environment.platform.os) : null;
  if (!props.environment || !computer) return null;
  return (
    <SettingsRow
      title={searchableSetting("serve-mode").title}
      description={DESCRIPTIONS[computer]}
      status={
        props.environment.capabilities.serveModeLidClosed !== false ? undefined : (
          <span className="block text-warning">
            Closing the lid still sleeps this Mac. To keep it running lid-closed, run{" "}
            <code>sudo scripts/serve-mode/install.sh</code> from a T3 Code checkout on it.
          </span>
        )
      }
      control={
        <Switch
          checked={serveMode}
          onCheckedChange={(checked) => updateSettings({ serveMode: checked })}
          aria-label="Serve mode"
        />
      }
    />
  );
}
