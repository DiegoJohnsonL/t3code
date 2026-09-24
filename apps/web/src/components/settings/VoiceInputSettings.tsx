import type { DesktopFnKeySetup } from "@t3tools/contracts";
import { CheckIcon } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { toastManager } from "../ui/toast";
import { SettingsRow, SettingsSection } from "./settingsLayout";
import { searchableSetting } from "./settingsSearch";
import { useSettingsScope } from "./SettingsScopeContext";
import { useScopedSettings, useUpdateScopedSettings } from "./useScopedSettings";

/** Frees the Mac fn/🌐 key for hold-to-talk; rendered only where the desktop shell can do it. */
function FnKeySetupControl() {
  const bridge = window.desktopBridge;
  const [setup, setSetup] = useState<DesktopFnKeySetup | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void bridge?.readFnKeySetup?.().then((next) => {
      if (!cancelled) setSetup(next);
    });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  const applyFnKeySetup = bridge?.applyFnKeySetup;
  if (!applyFnKeySetup || setup === null) return null;
  if (setup === "ready") {
    return (
      <span className="flex items-center gap-1 text-sm text-muted-foreground">
        <CheckIcon aria-hidden className="size-3.5" />
        fn key ready
      </span>
    );
  }
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={applying}
      onClick={() => {
        setApplying(true);
        void applyFnKeySetup()
          .then((next) => {
            setSetup(next);
            if (next === "ready") return;
            toastManager.add({
              type: "error",
              title: "Could not free the fn key",
              description: "Set System Settings → Keyboard → Press 🌐 key to → Do Nothing instead.",
            });
          })
          .finally(() => setApplying(false));
      }}
    >
      Free up fn key
    </Button>
  );
}

export function VoiceInputSettingsSection() {
  const settings = useScopedSettings();
  const updateSettings = useUpdateScopedSettings();
  const { connectedEnvironments } = useSettingsScope();
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const { dictation } = settings;
  const hasServerTargets = connectedEnvironments.length > 0;

  const saveApiKey = () => {
    const apiKey = apiKeyDraft.trim();
    if (apiKey.length === 0) return;
    updateSettings({ dictation: { apiKey } });
    setApiKeyDraft("");
  };

  return (
    <SettingsSection id="voice-input" title="Voice input">
      <SettingsRow
        serverScoped
        settingKeys={["dictation"]}
        {...searchableSetting("voice-input-api-key")}
        description={
          <>
            Transcribes and cleans up voice input on this environment with Groq. Get a free key at{" "}
            <a
              className="underline underline-offset-2"
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
            >
              console.groq.com/keys
            </a>
            .
          </>
        }
        control={
          !hasServerTargets ? (
            <span className="text-sm text-muted-foreground">
              Connect an environment to set up voice input.
            </span>
          ) : dictation.apiKey.length > 0 ? (
            <div className="flex items-center gap-2">
              <FnKeySetupControl />
              <span className="text-sm text-muted-foreground">Key saved</span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => updateSettings({ dictation: { apiKey: "" } })}
              >
                Remove
              </Button>
            </div>
          ) : (
            <form
              className="flex items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                saveApiKey();
              }}
            >
              <FnKeySetupControl />
              <div className="w-56">
                <Input
                  type="password"
                  autoComplete="off"
                  placeholder="gsk_…"
                  value={apiKeyDraft}
                  onChange={(event) => setApiKeyDraft(event.target.value)}
                  aria-label="Groq API key"
                />
              </div>
              <Button size="sm" type="submit" disabled={apiKeyDraft.trim().length === 0}>
                Save
              </Button>
            </form>
          )
        }
      />
      <SettingsRow
        serverScoped
        settingKeys={["dictation"]}
        {...searchableSetting("voice-input-vocabulary")}
        description="Names and terms voice input should spell exactly, one per line."
      >
        <div className="mt-3 max-w-2xl pb-3.5">
          <Textarea
            key={dictation.vocabulary}
            defaultValue={dictation.vocabulary}
            disabled={!hasServerTargets}
            onBlur={(event) => {
              const vocabulary = event.target.value.trim();
              if (vocabulary !== dictation.vocabulary) {
                updateSettings({ dictation: { vocabulary } });
              }
            }}
            rows={4}
            placeholder={"T3 Code\nEffect\nTanStack Router"}
            aria-label="Voice input vocabulary"
          />
        </div>
      </SettingsRow>
    </SettingsSection>
  );
}
