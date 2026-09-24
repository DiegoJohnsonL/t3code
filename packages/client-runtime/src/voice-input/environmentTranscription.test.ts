import { describe, expect, it } from "vite-plus/test";

import {
  createEnvironmentVoiceTranscriber,
  type EnvironmentVoiceTranscriptionTransport,
} from "./environmentTranscription.ts";
import { VoiceTranscriptionError } from "./transcription.ts";

function makeTransport(
  overrides: Partial<EnvironmentVoiceTranscriptionTransport> = {},
): EnvironmentVoiceTranscriptionTransport {
  return {
    describeRecording: async () => ({ mimeType: "audio/webm", sizeBytes: 4 }),
    createUploadUrl: async () => "https://environment.test/api/voice/transcriptions/token",
    upload: async () => ({ status: 200, body: '{"text":"Fix the flaky test."}' }),
    ...overrides,
  };
}

async function transcribe(transport: EnvironmentVoiceTranscriptionTransport, signal?: AbortSignal) {
  const controller = new AbortController();
  const prepared = await createEnvironmentVoiceTranscriber({ locale: "en-US", transport }).prepare({
    signal: controller.signal,
  });
  return prepared.transcribe("blob:recording", { signal: signal ?? controller.signal });
}

async function rejection(promise: Promise<unknown>): Promise<VoiceTranscriptionError> {
  const error = await promise.then(
    () => null,
    (cause: unknown) => cause,
  );
  if (!(error instanceof VoiceTranscriptionError))
    throw new Error("Expected a transcription error");
  return error;
}

describe("createEnvironmentVoiceTranscriber", () => {
  it("returns the environment's cleaned transcript", async () => {
    await expect(transcribe(makeTransport())).resolves.toBe("Fix the flaky test.");
  });

  it("shows the environment's reason when it refuses the recording", async () => {
    const error = await rejection(
      transcribe(
        makeTransport({
          upload: async () => ({ status: 429, body: "Try again in a minute." }),
        }),
      ),
    );
    expect(error.code).toBe("rejected");
    expect(error.message).toBe("Try again in a minute.");
  });

  it("explains a missing dictation key", async () => {
    const error = await rejection(
      transcribe(
        makeTransport({
          createUploadUrl: async () => {
            throw { _tag: "VoiceTranscriptionNotConfiguredError" };
          },
        }),
      ),
    );
    expect(error.code).toBe("rejected");
    expect(error.message).toContain("dictation API key");
  });

  it("reports cancellation instead of a late failure", async () => {
    const controller = new AbortController();
    const error = await rejection(
      transcribe(
        makeTransport({
          upload: async () => {
            controller.abort();
            throw new Error("socket closed");
          },
        }),
        controller.signal,
      ),
    );
    expect(error.code).toBe("cancelled");
  });
});
