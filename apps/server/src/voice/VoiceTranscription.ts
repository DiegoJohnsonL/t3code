import { APICallError, generateText, RetryError, transcribe } from "ai";
import * as Context from "effect/Context";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import * as ServerSettings from "../serverSettings.ts";
import {
  makeGroqDictationProvider,
  type DictationProvider,
  type MakeDictationProvider,
} from "./DictationProvider.ts";
import {
  buildCleanupSystemPrompt,
  buildCleanupUserPrompt,
  buildTranscriptionPrompt,
  parseDictationVocabulary,
} from "./dictationPrompts.ts";

export type VoiceTranscriptionFailureReason =
  | "not-configured"
  | "unauthorized"
  | "rate-limited"
  | "provider";

export class VoiceTranscriptionFailure extends Data.TaggedError("VoiceTranscriptionFailure")<{
  readonly reason: VoiceTranscriptionFailureReason;
  readonly cause?: unknown;
}> {
  override get message(): string {
    switch (this.reason) {
      case "not-configured":
        return "Add a dictation API key in Settings to use voice input.";
      case "unauthorized":
        return "The dictation API key was rejected. Check it in Settings.";
      case "rate-limited":
        return "The dictation provider is rate limiting requests. Try again in a minute.";
      case "provider":
        return "The dictation provider could not transcribe this recording.";
    }
  }
}

function classifyProviderError(cause: unknown): VoiceTranscriptionFailure {
  const error = RetryError.isInstance(cause) ? cause.lastError : cause;
  if (APICallError.isInstance(error)) {
    if (error.statusCode === 401 || error.statusCode === 403) {
      return new VoiceTranscriptionFailure({ reason: "unauthorized", cause });
    }
    if (error.statusCode === 429) {
      return new VoiceTranscriptionFailure({ reason: "rate-limited", cause });
    }
  }
  return new VoiceTranscriptionFailure({ reason: "provider", cause });
}

export class VoiceTranscription extends Context.Service<
  VoiceTranscription,
  {
    readonly isConfigured: Effect.Effect<boolean>;
    /** Transcribes a recording and cleans it up into the text the speaker meant to send. */
    readonly transcribe: (audio: Uint8Array) => Effect.Effect<string, VoiceTranscriptionFailure>;
  }
>()("t3/voice/VoiceTranscription") {}

const PROVIDER_CALL_MAX_RETRIES = 1;

const transcribeWithProvider = (input: {
  readonly provider: DictationProvider;
  readonly audio: Uint8Array;
  readonly vocabulary: ReadonlyArray<string>;
}) =>
  Effect.tryPromise({
    try: (abortSignal) =>
      transcribe({
        model: input.provider.transcriptionModel,
        audio: input.audio,
        providerOptions: input.provider.transcriptionOptions({
          vocabularyPrompt: buildTranscriptionPrompt(input.vocabulary),
        }),
        maxRetries: PROVIDER_CALL_MAX_RETRIES,
        abortSignal,
      }),
    catch: classifyProviderError,
  }).pipe(Effect.map((result) => result.text.trim()));

const cleanUpWithProvider = (input: {
  readonly provider: DictationProvider;
  readonly transcript: string;
  readonly vocabulary: ReadonlyArray<string>;
}) =>
  Effect.tryPromise({
    try: (abortSignal) =>
      generateText({
        model: input.provider.cleanupModel,
        system: buildCleanupSystemPrompt(input.vocabulary),
        prompt: buildCleanupUserPrompt(input.transcript),
        providerOptions: input.provider.cleanupOptions,
        maxRetries: PROVIDER_CALL_MAX_RETRIES,
        abortSignal,
      }),
    catch: classifyProviderError,
  }).pipe(Effect.map((result) => result.text.replace(/[ \t]+$/gm, "").trim()));

export const make = (makeProvider: MakeDictationProvider) =>
  Effect.gen(function* () {
    const serverSettings = yield* ServerSettings.ServerSettingsService;
    const readDictationSettings = serverSettings.getSettings.pipe(
      Effect.map((settings) => settings.dictation),
      Effect.orDie,
    );

    const transcribeRecording = Effect.fn("VoiceTranscription.transcribe")(function* (
      audio: Uint8Array,
    ) {
      const dictation = yield* readDictationSettings;
      if (dictation.apiKey.length === 0) {
        return yield* new VoiceTranscriptionFailure({ reason: "not-configured" });
      }
      const provider = makeProvider({ apiKey: dictation.apiKey });
      const vocabulary = parseDictationVocabulary(dictation.vocabulary);

      const transcript = yield* transcribeWithProvider({ provider, audio, vocabulary });
      if (transcript.length === 0) return "";

      // A failed cleanup still leaves the speaker's words, which beats losing the recording.
      return yield* cleanUpWithProvider({ provider, transcript, vocabulary }).pipe(
        Effect.catch((failure) =>
          Effect.logWarning("Dictation cleanup failed; using the raw transcript.", {
            reason: failure.reason,
            cause: failure.cause,
          }).pipe(Effect.as(transcript)),
        ),
      );
    });

    return VoiceTranscription.of({
      isConfigured: readDictationSettings.pipe(
        Effect.map((dictation) => dictation.apiKey.length > 0),
      ),
      transcribe: transcribeRecording,
    });
  });

export const layer = Layer.effect(VoiceTranscription, make(makeGroqDictationProvider));
