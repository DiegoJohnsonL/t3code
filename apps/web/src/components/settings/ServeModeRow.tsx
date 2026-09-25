import type { ExecutionEnvironmentDescriptor, UnifiedSettings } from "@t3tools/contracts";
import {
  serveModeComputerName,
  WINDOWS_LID_CLOSED_SETUP,
  WINDOWS_POWER_SAVING_DESCRIPTION,
} from "@t3tools/client-runtime/serve-mode";

import { usePrimarySettings, useUpdatePrimarySettings } from "~/hooks/useSettings";
import { Switch } from "../ui/switch";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

const selectServeMode = (settings: UnifiedSettings) => settings.serveMode;
const selectServeModePowerSaving = (settings: UnifiedSettings) => settings.serveModePowerSaving;

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
  if (!props.environment || !computer || props.environment.capabilities.serveMode !== true) {
    return null;
  }
  return (
    <>
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
      {computer === "PC" ? <ServeModePowerSavingRow /> : null}
    </>
  );
}

function ServeModePowerSavingRow() {
  const powerSaving = usePrimarySettings(selectServeModePowerSaving);
  const updateSettings = useUpdatePrimarySettings();
  return (
    <SettingsRow
      title={searchableSetting("serve-mode-power-saving").title}
      description={WINDOWS_POWER_SAVING_DESCRIPTION}
      control={
        <Switch
          checked={powerSaving}
          onCheckedChange={(checked) => updateSettings({ serveModePowerSaving: checked })}
          aria-label="Power saving in serve mode"
        />
      }
    />
  );
}
