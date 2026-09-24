import type { EnvironmentId } from "@t3tools/contracts";
import { resolveAssetUrl } from "@t3tools/client-runtime/state/assets";
import { runAtomCommand, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentVoiceTranscriptionTransport } from "@t3tools/client-runtime/voice-input";

import { appAtomRegistry } from "../rpc/atomRegistry";
import { readPreparedConnection } from "../state/session";
import { voiceEnvironment } from "../state/voice";

async function readRecording(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

export function makeEnvironmentVoiceTranscriptionTransport(
  environmentId: EnvironmentId,
): EnvironmentVoiceTranscriptionTransport {
  return {
    describeRecording: async (uri) => {
      const recording = await readRecording(uri);
      return { mimeType: recording.type || "audio/webm", sizeBytes: recording.size };
    },
    createUploadUrl: async (input) => {
      const minted = await runAtomCommand(
        appAtomRegistry,
        voiceEnvironment.createTranscriptionUrl,
        { environmentId, input },
        { reportFailure: false },
      );
      if (minted._tag !== "Success") throw squashAtomCommandFailure(minted);
      const connection = readPreparedConnection(environmentId);
      const url = connection
        ? resolveAssetUrl(connection.httpBaseUrl, minted.value.relativeUrl)
        : null;
      if (!url) throw new Error("The environment is not connected.");
      return url;
    },
    upload: async ({ url, uri, mimeType, signal }) => {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: await readRecording(uri),
        signal,
      });
      return { status: response.status, body: await response.text() };
    },
  };
}
