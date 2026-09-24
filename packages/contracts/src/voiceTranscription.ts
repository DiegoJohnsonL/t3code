import * as Schema from "effect/Schema";

import { NonNegativeInt, TrimmedNonEmptyString } from "./baseSchemas.ts";

/** A client mints the URL after recording stops, right before it uploads. */
export const VOICE_TRANSCRIPTION_URL_TTL_MS = 2 * 60_000;

export const VOICE_TRANSCRIPTION_MAX_BYTES = 25 * 1024 * 1024;

export const VoiceTranscriptionCreateUrlInput = Schema.Struct({
  mimeType: TrimmedNonEmptyString.check(Schema.isMaxLength(100)),
  sizeBytes: NonNegativeInt.check(
    Schema.isGreaterThanOrEqualTo(1),
    Schema.isLessThanOrEqualTo(VOICE_TRANSCRIPTION_MAX_BYTES),
  ),
});
export type VoiceTranscriptionCreateUrlInput = typeof VoiceTranscriptionCreateUrlInput.Type;

/** POST the recording to `relativeUrl`; the response body is a `VoiceTranscriptionResult`. */
export const VoiceTranscriptionCreateUrlResult = Schema.Struct({
  relativeUrl: TrimmedNonEmptyString.check(Schema.isMaxLength(4096)),
  expiresAt: Schema.Number,
});
export type VoiceTranscriptionCreateUrlResult = typeof VoiceTranscriptionCreateUrlResult.Type;

export const VoiceTranscriptionResult = Schema.Struct({
  text: Schema.String,
});
export type VoiceTranscriptionResult = typeof VoiceTranscriptionResult.Type;

export class VoiceTranscriptionNotConfiguredError extends Schema.TaggedError<VoiceTranscriptionNotConfiguredError>()(
  "VoiceTranscriptionNotConfiguredError",
  {},
) {
  override get message(): string {
    return "Add a dictation API key in Settings to use voice input.";
  }
}

export class VoiceTranscriptionSigningKeyError extends Schema.TaggedError<VoiceTranscriptionSigningKeyError>()(
  "VoiceTranscriptionSigningKeyError",
  {
    cause: Schema.Defect(),
  },
) {
  override get message(): string {
    return "Failed to load the voice transcription signing key.";
  }
}
