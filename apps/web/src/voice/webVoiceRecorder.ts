import type { VoiceRecorder, VoiceRecorderStatus } from "@t3tools/client-runtime/voice-input";

const PREFERRED_MIME_TYPES = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"];
const VOICE_BITS_PER_SECOND = 32_000;

/**
 * `MediaRecorder` behind the shared controller's recorder interface. A finished
 * recording is exposed as a blob URL; the controller revokes it through
 * `deleteRecording` once the transcript lands or the recording is discarded.
 */
export class WebVoiceRecorder implements VoiceRecorder {
  uri: string | null = null;
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stopped: Promise<void> | null = null;
  private limitTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly onStatus: (status: VoiceRecorderStatus) => void;

  constructor(onStatus: (status: VoiceRecorderStatus) => void) {
    this.onStatus = onStatus;
  }

  async acquireMicrophone(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true },
    });
  }

  releaseMicrophone(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
  }

  async prepareToRecordAsync(): Promise<void> {
    if (!this.stream) throw new Error("The microphone is not open.");
    const mimeType = PREFERRED_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
    const mediaRecorder = new MediaRecorder(this.stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: VOICE_BITS_PER_SECOND,
    });
    mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });
    mediaRecorder.addEventListener("error", () => {
      this.onStatus({ isFinished: false, hasError: true, error: "Recording failed.", url: null });
    });
    this.chunks = [];
    this.uri = null;
    this.mediaRecorder = mediaRecorder;
  }

  record(options: { readonly forDuration: number }): void {
    const mediaRecorder = this.mediaRecorder;
    if (!mediaRecorder) return;
    this.stopped = new Promise((resolve) => {
      mediaRecorder.addEventListener(
        "stop",
        () => {
          const blob = new Blob(this.chunks, { type: mediaRecorder.mimeType || "audio/webm" });
          this.chunks = [];
          this.uri = URL.createObjectURL(blob);
          resolve();
        },
        { once: true },
      );
    });
    mediaRecorder.start();
    this.limitTimer = setTimeout(() => {
      void this.stop().then(() =>
        this.onStatus({ isFinished: true, hasError: false, error: null, url: this.uri }),
      );
    }, options.forDuration * 1000);
  }

  async stop(): Promise<void> {
    if (this.limitTimer !== null) clearTimeout(this.limitTimer);
    this.limitTimer = null;
    if (this.mediaRecorder?.state === "recording") this.mediaRecorder.stop();
    await this.stopped;
  }
}

export async function requestMicrophonePermission(): Promise<{
  readonly granted: boolean;
  readonly canAskAgain: boolean;
}> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    for (const track of stream.getTracks()) track.stop();
    return { granted: true, canAskAgain: true };
  } catch (error) {
    const blocked = error instanceof DOMException && error.name === "NotAllowedError";
    return { granted: false, canAskAgain: !blocked };
  }
}

export function canRecordVoice(): boolean {
  return (
    typeof MediaRecorder !== "undefined" &&
    typeof navigator !== "undefined" &&
    navigator.mediaDevices?.getUserMedia !== undefined
  );
}
