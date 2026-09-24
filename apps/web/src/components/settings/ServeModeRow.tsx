import type { UnifiedSettings } from "@t3tools/contracts";

import { usePrimarySettings, useUpdatePrimarySettings } from "~/hooks/useSettings";
import { Switch } from "../ui/switch";
import { SettingsRow } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";

const selectServeMode = (settings: UnifiedSettings) => settings.serveMode;

/** Only rendered for macOS servers; the server ignores the setting elsewhere. */
export function ServeModeRow(props: { readonly lidClosedHelperInstalled: boolean }) {
  const serveMode = usePrimarySettings(selectServeMode);
  const updateSettings = useUpdatePrimarySettings();
  return (
    <SettingsRow
      title={searchableSetting("serve-mode").title}
      description="Keep this Mac awake while T3 Code runs, so agents keep working and your phone can connect. The display still sleeps and locks. With the one-time helper from scripts/serve-mode, it also keeps running with the lid closed while plugged in and uses Low Power Mode."
      status={
        props.lidClosedHelperInstalled ? undefined : (
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
