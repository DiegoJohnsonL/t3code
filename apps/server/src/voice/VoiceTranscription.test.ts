import { assert, describe, expect, it } from "@effect/vitest";
import { APICallError, type TranscriptionModel } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";

import * as ServerSettings from "../serverSettings.ts";
import type { DictationProvider } from "./DictationProvider.ts";
import * as VoiceTranscription from "./VoiceTranscription.ts";

const transcriptionResult = (text: string) => ({
  text,
  segments: [],
  language: "en",
  durationInSeconds: 1,
  warnings: [],
  response: { timestamp: DateTime.toDateUtc(DateTime.makeUnsafe(0)), modelId: "mock-transcriber" },
});

type MockTranscriber = Exclude<TranscriptionModel, string> & {
  readonly specificationVersion: "v4";
};

const mockTranscriber = (doGenerate: MockTranscriber["doGenerate"]): MockTranscriber => ({
  specificationVersion: "v4",
  provider: "mock",
  modelId: "mock-transcriber",
  doGenerate,
});

const cleanupResult = (text: string) => ({
  content: [{ type: "text" as const, text }],
  finishReason: { unified: "stop" as const, raw: "stop" },
  usage: {
    inputTokens: { total: 1, noCache: 1, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 1, text: 1, reasoning: 0 },
  },
  warnings: [],
});

const rateLimited = () =>
  new APICallError({
    message: "Rate limit reached",
    url: "https://provider.test",
    requestBodyValues: {},
    statusCode: 429,
    isRetryable: false,
  });

function makeTestProvider(input: {
  readonly transcription: MockTranscriber;
  readonly cleanup: MockLanguageModelV4;
}): DictationProvider {
  return {
    transcriptionModel: input.transcription,
    transcriptionOptions: ({ vocabularyPrompt }) =>
      vocabularyPrompt === undefined ? {} : { mock: { prompt: vocabularyPrompt } },
    cleanupModel: input.cleanup,
    cleanupOptions: {},
  };
}

const runTranscription = (input: {
  readonly provider: DictationProvider;
  readonly apiKey?: string;
  readonly vocabulary?: string;
}) =>
  Effect.gen(function* () {
    const service = yield* VoiceTranscription.make(() => input.provider);
    return yield* service.transcribe(new Uint8Array([1, 2, 3]));
  }).pipe(
    Effect.provide(
      ServerSettings.layerTest({
        dictation: { apiKey: input.apiKey ?? "test-key", vocabulary: input.vocabulary ?? "" },
      }),
    ),
  );

describe("VoiceTranscription", () => {
  it.effect("requires an API key before calling the provider", () =>
    Effect.gen(function* () {
      const transcription = mockTranscriber(async () => transcriptionResult("unused"));
      const failure = yield* Effect.flip(
        runTranscription({
          apiKey: "",
          provider: makeTestProvider({ transcription, cleanup: new MockLanguageModelV4() }),
        }),
      );
      assert(failure instanceof VoiceTranscription.VoiceTranscriptionFailure);
      expect(failure.reason).toBe("not-configured");
    }),
  );

  it.effect("biases transcription and cleanup with the speaker's vocabulary", () =>
    Effect.gen(function* () {
      let transcriptionProviderOptions: unknown;
      const transcription = mockTranscriber(async (options) => {
        transcriptionProviderOptions = options.providerOptions;
        return transcriptionResult("um so tea three code uh is ready");
      });
      const cleanup = new MockLanguageModelV4({
        doGenerate: cleanupResult("T3 Code is ready."),
      });

      const text = yield* runTranscription({
        vocabulary: "T3 Code\nEffect\nT3 Code\n",
        provider: makeTestProvider({ transcription, cleanup }),
      });

      expect(text).toBe("T3 Code is ready.");
      expect(transcriptionProviderOptions).toEqual({ mock: { prompt: "T3 Code, Effect." } });
      const [system, user] = cleanup.doGenerateCalls[0]?.prompt ?? [];
      assert(system?.role === "system" && user?.role === "user");
      expect(system.content).toContain("- T3 Code\n- Effect");
      expect(user.content).toContainEqual(
        expect.objectContaining({
          text: expect.stringContaining("um so tea three code uh is ready"),
        }),
      );
    }),
  );

  it.effect("skips cleanup when nothing was said", () =>
    Effect.gen(function* () {
      const transcription = mockTranscriber(async () => transcriptionResult("   "));
      const cleanup = new MockLanguageModelV4({ doGenerate: cleanupResult("invented") });

      const text = yield* runTranscription({
        provider: makeTestProvider({ transcription, cleanup }),
      });

      expect(text).toBe("");
      expect(cleanup.doGenerateCalls).toHaveLength(0);
    }),
  );

  it.effect("keeps the raw transcript when cleanup fails", () =>
    Effect.gen(function* () {
      const transcription = mockTranscriber(async () => transcriptionResult("um fix the bug"));
      const cleanup = new MockLanguageModelV4({
        doGenerate: async () => {
          throw rateLimited();
        },
      });

      const text = yield* runTranscription({
        provider: makeTestProvider({ transcription, cleanup }),
      });

      expect(text).toBe("um fix the bug");
    }),
  );

  it.effect("reports a rate-limited transcription", () =>
    Effect.gen(function* () {
      const transcription = mockTranscriber(async () => {
        throw rateLimited();
      });

      const failure = yield* Effect.flip(
        runTranscription({
          provider: makeTestProvider({ transcription, cleanup: new MockLanguageModelV4() }),
        }),
      );

      assert(failure instanceof VoiceTranscription.VoiceTranscriptionFailure);
      expect(failure.reason).toBe("rate-limited");
    }),
  );
});
