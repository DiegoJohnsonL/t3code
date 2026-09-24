import { CheckIcon, MicIcon, XIcon } from "lucide-react";
import { useEffect, useState } from "react";

import type { ComposerVoiceInput } from "~/voice/useComposerVoiceInput";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function RecordingElapsed({ startedAt }: { readonly startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);
  return (
    <span className="flex items-center gap-1.5 px-1 text-muted-foreground text-xs tabular-nums">
      <span aria-hidden className="size-1.5 rounded-full bg-destructive" />
      {formatElapsed(now - startedAt)}
    </span>
  );
}

const keepEditorFocus = (event: React.PointerEvent) => event.preventDefault();

export function ComposerVoiceControl(props: {
  readonly voice: ComposerVoiceInput;
  readonly shortcutLabel: string | null;
}) {
  const { voice } = props;
  switch (voice.state.phase) {
    case "recording":
      return (
        <div className="flex items-center gap-0.5" role="group" aria-label="Voice recording">
          {voice.recordingStartedAt === null ? null : (
            <RecordingElapsed startedAt={voice.recordingStartedAt} />
          )}
          <Button
            type="button"
            variant="ghost-muted"
            size="icon-sm"
            onPointerDown={keepEditorFocus}
            onClick={voice.cancel}
            aria-label="Discard recording"
          >
            <XIcon />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onPointerDown={keepEditorFocus}
            onClick={voice.toggle}
            aria-label="Insert transcript"
          >
            <CheckIcon />
          </Button>
        </div>
      );
    case "preparing":
    case "transcribing":
      return (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onPointerDown={keepEditorFocus}
          onClick={voice.cancel}
          aria-label={voice.state.phase === "transcribing" ? "Cancel transcription" : "Cancel"}
        >
          <Spinner />
        </Button>
      );
    case "idle":
    case "error":
      return (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onPointerDown={keepEditorFocus}
                onClick={voice.toggle}
                aria-label="Voice input"
              />
            }
          >
            <MicIcon />
          </TooltipTrigger>
          <TooltipPopup>
            {props.shortcutLabel ? `Voice input · hold ${props.shortcutLabel}` : "Voice input"}
          </TooltipPopup>
        </Tooltip>
      );
  }
}
