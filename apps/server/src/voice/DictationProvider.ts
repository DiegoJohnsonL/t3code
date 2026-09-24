import { createGroq } from "@ai-sdk/groq";
import type { generateText, LanguageModel, TranscriptionModel } from "ai";

type ProviderOptions = NonNullable<Parameters<typeof generateText>[0]["providerOptions"]>;

/**
 * The models one dictation provider supplies. The pipeline in
 * `VoiceTranscription.ts` is provider-neutral; switching providers means
 * writing another factory like `makeGroqDictationProvider` and selecting it
 * in that module's layer.
 */
export interface DictationProvider {
  readonly transcriptionModel: TranscriptionModel;
  readonly transcriptionOptions: (input: {
    readonly vocabularyPrompt: string | undefined;
  }) => ProviderOptions;
  readonly cleanupModel: LanguageModel;
  readonly cleanupOptions: ProviderOptions;
}

export type MakeDictationProvider = (input: { readonly apiKey: string }) => DictationProvider;

export const makeGroqDictationProvider: MakeDictationProvider = ({ apiKey }) => {
  const groq = createGroq({ apiKey });
  return {
    transcriptionModel: groq.transcription("whisper-large-v3-turbo"),
    transcriptionOptions: ({ vocabularyPrompt }) =>
      vocabularyPrompt === undefined ? {} : { groq: { prompt: vocabularyPrompt } },
    cleanupModel: groq("openai/gpt-oss-120b"),
    // GPT-OSS cannot turn reasoning off; `low` keeps it short.
    cleanupOptions: { groq: { reasoningEffort: "low" } },
  };
};
