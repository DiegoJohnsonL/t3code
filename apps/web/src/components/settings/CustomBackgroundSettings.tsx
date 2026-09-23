import { openBackgroundStudio } from "~/customBackground/backgroundStudioStore";
import { useActiveBackground } from "~/customBackground/useActiveBackground";
import { useClientSettings, useUpdateClientSettings } from "~/hooks/useSettings";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";
import { SettingResetButton, SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { MonitorCog } from "lucide-react";

export function CustomBackgroundSettings() {
  const active = useActiveBackground();
  const enabled = useClientSettings((settings) => settings.customBackgroundEnabled);
  const dynamicTheme = useClientSettings((settings) => settings.customBackgroundDynamicTheme);
  const textGlow = useClientSettings((settings) => settings.customBackgroundTextGlow);
  const agentBubbles = useClientSettings((settings) => settings.customBackgroundAgentBubbles);
  const libraryCount = useClientSettings((settings) => settings.customBackgrounds.length);
  const updateSettings = useUpdateClientSettings();

  return (
    <SettingsSection id="appearance-background" title="Background">
      <SettingsRow
        {...searchableSetting("custom-background")}
        description="Put your own pictures behind your chats, with filters and rotation. Saved only on this client."
        status={
          active
            ? `Selected: “${active.name}”`
            : libraryCount > 0
              ? `${libraryCount} saved, none selected`
              : null
        }
        resetAction={
          active ? (
            <SettingResetButton
              label="custom background"
              onClick={() => updateSettings({ activeCustomBackgroundId: null })}
            />
          ) : null
        }
        control={
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" disabled={!enabled} onClick={openBackgroundStudio}>
              <MonitorCog /> Customize background
            </Button>
            <Switch
              checked={enabled}
              onCheckedChange={(checked) =>
                updateSettings({ customBackgroundEnabled: Boolean(checked) })
              }
              aria-label="Enable custom background"
            />
          </div>
        }
      />
      <SettingsRow
        {...searchableSetting("background-dynamic-theme")}
        description="Repaint the app from the colors of whichever picture is showing. Each image in a playlist brings its own palette."
        control={
          <Switch
            checked={dynamicTheme}
            onCheckedChange={(checked) =>
              updateSettings({ customBackgroundDynamicTheme: Boolean(checked) })
            }
            aria-label="Theme from image colors"
          />
        }
      />
      <SettingsRow
        {...searchableSetting("background-text-glow")}
        description="Draw a soft halo in your theme's background color around chat text, so it reads over busy pictures."
        control={
          <Switch
            checked={textGlow}
            onCheckedChange={(checked) =>
              updateSettings({ customBackgroundTextGlow: Boolean(checked) })
            }
            aria-label="Glow behind text"
          />
        }
      />
      <SettingsRow
        {...searchableSetting("background-agent-bubbles")}
        description="Set the text of agent replies on a translucent bubble, like your own messages."
        control={
          <Switch
            checked={agentBubbles}
            onCheckedChange={(checked) =>
              updateSettings({ customBackgroundAgentBubbles: Boolean(checked) })
            }
            aria-label="Bubbles behind agent replies"
          />
        }
      />
    </SettingsSection>
  );
}
