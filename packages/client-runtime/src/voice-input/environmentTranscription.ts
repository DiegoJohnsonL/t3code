import {
  VoiceTranscriptionResult,
  type ServerConfig,
  type VoiceTranscriptionCreateUrlInput,
} from "@t3tools/contracts";
import * as Schema from "effect/Schema";

import {
  VoiceTranscriptionError,
  throwIfVoiceTranscriptionAborted,
  type VoiceTranscriber,
  type VoiceTranscriptionOptions,
} from "./transcription.ts";

/** Whether the environment can transcribe recordings and has a dictation key configured. */
export function environmentSupportsVoiceTranscription(
  config: Pick<ServerConfig, "environment" | "settings"> | null,
): boolean {
  return (
    config?.environment.capabilities.voiceTranscription === true &&
    config.settings.dictation.apiKey.length > 0
  );
}

/** Platform I/O for sending a finished recording to the environment. */
export type EnvironmentVoiceTranscriptionTransport = {
  readonly describeRecording: (uri: string) => Promise<VoiceTranscriptionCreateUrlInput>;
  /** Mints a signed upload URL and resolves it against the environment's HTTP origin. */
  readonly createUploadUrl: (input: VoiceTranscriptionCreateUrlInput) => Promise<string>;
  readonly upload: (input: {
    readonly url: string;
    readonly uri: string;
    readonly mimeType: string;
    readonly signal: AbortSignal;
  }) => Promise<{ readonly status: number; readonly body: string }>;
};

const decodeTranscriptionResult = Schema.decodeUnknownSync(
  Schema.fromJsonString(VoiceTranscriptionResult),
);

function isNotConfiguredFailure(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "_tag" in error &&
    error._tag === "VoiceTranscriptionNotConfiguredError"
  );
}

async function transcribeRecording(
  transport: EnvironmentVoiceTranscriptionTransport,
  uri: string,
  { signal }: VoiceTranscriptionOptions,
): Promise<string> {
  try {
    throwIfVoiceTranscriptionAborted(signal);
    const recording = await transport.describeRecording(uri);
    throwIfVoiceTranscriptionAborted(signal);
    const url = await transport.createUploadUrl(recording);
    throwIfVoiceTranscriptionAborted(signal);
    const response = await transport.upload({ url, uri, mimeType: recording.mimeType, signal });
    throwIfVoiceTranscriptionAborted(signal);
    if (response.status !== 200) {
      throw new VoiceTranscriptionError(
        "rejected",
        response.body.trim() || "The environment could not transcribe this recording.",
      );
    }
    return decodeTranscriptionResult(response.body).text;
  } catch (error) {
    throwIfVoiceTranscriptionAborted(signal);
    if (error instanceof VoiceTranscriptionError) throw error;
    if (isNotConfiguredFailure(error)) {
      throw new VoiceTranscriptionError(
        "rejected",
        "Add a dictation API key in Settings to use voice input.",
        { cause: error },
      );
    }
    throw new VoiceTranscriptionError("transcription-failed", "Voice transcription failed.", {
      cause: error,
    });
  }
}

/**
 * Transcribes on the connected environment. `locale` only steers how the
 * controller spaces the inserted text; the environment detects the language.
 */
export function createEnvironmentVoiceTranscriber(input: {
  readonly locale: string;
  readonly transport: EnvironmentVoiceTranscriptionTransport;
}): VoiceTranscriber {
  return {
    prepare: async ({ signal }) => {
      throwIfVoiceTranscriptionAborted(signal);
      return {
        locale: input.locale,
        transcribe: (uri, options) => transcribeRecording(input.transport, uri, options),
      };
    },
  };
}
