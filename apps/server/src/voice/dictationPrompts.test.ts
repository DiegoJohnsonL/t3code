import { describe, expect, it } from "@effect/vitest";

import {
  buildTranscriptionPrompt,
  isEchoedTranscriptionPrompt,
  threadNames,
} from "./dictationPrompts.ts";

describe("buildTranscriptionPrompt", () => {
  it("puts the most important terms last and drops what does not fit", () => {
    const filler = Array.from({ length: 200 }, (_, index) => `term${index}`);
    const prompt = buildTranscriptionPrompt(["T3 Code", "Effect Schema", ...filler]);
    expect(prompt?.endsWith("Effect Schema, T3 Code.")).toBe(true);
    expect(prompt?.length).toBeLessThanOrEqual(500);
    expect(prompt).not.toContain("term199");
  });
});

describe("isEchoedTranscriptionPrompt", () => {
  it("recognizes Whisper returning its hint instead of speech", () => {
    expect(isEchoedTranscriptionPrompt("Effect Schema, T3 Code.", "Effect Schema, T3 Code.")).toBe(
      true,
    );
    expect(isEchoedTranscriptionPrompt("Ship the T3 Code fix.", "Effect Schema, T3 Code.")).toBe(
      false,
    );
  });
});

describe("threadNames", () => {
  it("collects code names and files, newest message first", () => {
    expect(
      threadNames([
        { text: "Look at `apps/web/src/voice/useComposerVoiceInput.ts` please." },
        { text: "I updated ChatComposer.tsx and the `pushToTalkGesture` helper. All tests pass." },
      ]),
    ).toEqual([
      "pushToTalkGesture",
      "ChatComposer.tsx",
      "ChatComposer",
      "useComposerVoiceInput.ts",
      "useComposerVoiceInput",
    ]);
  });
});
