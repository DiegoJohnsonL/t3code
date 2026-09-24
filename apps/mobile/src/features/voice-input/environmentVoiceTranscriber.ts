import { resolveAssetUrl } from "@t3tools/client-runtime/state/assets";
import { runAtomCommand, squashAtomCommandFailure } from "@t3tools/client-runtime/state/runtime";
import {
  createEnvironmentVoiceTranscriber,
  findDictationCorrections,
  type VoiceTranscriber,
} from "@t3tools/client-runtime/voice-input";
import type { EnvironmentId, ThreadId } from "@t3tools/contracts";
import * as Option from "effect/Option";
import { File, UploadType } from "expo-file-system";

import { appAtomRegistry } from "../../state/atom-registry";
import { environmentSession } from "../../state/session";
import { voiceEnvironment } from "../../state/voice";

// expo-audio's HIGH_QUALITY preset records AAC in an MPEG-4 (.m4a) container on iOS and Android.
const RECORDING_MIME_TYPE = "audio/mp4";

/** Sends finished recordings to `environmentId`, which must support voice transcription. */
export function createMobileEnvironmentVoiceTranscriber({
  environmentId,
  threadId,
}: {
  readonly environmentId: EnvironmentId;
  readonly threadId: ThreadId | null;
}): VoiceTranscriber {
  return createEnvironmentVoiceTranscriber({
    locale: Intl.DateTimeFormat().resolvedOptions().locale,
    threadId,
    transport: {
      describeRecording: async (uri) => ({
        mimeType: RECORDING_MIME_TYPE,
        sizeBytes: new File(uri).size,
      }),
      createUploadUrl: async (input) => {
        const result = await runAtomCommand(
          appAtomRegistry,
          voiceEnvironment.createTranscriptionUrl,
          { environmentId, input },
          { reportFailure: false },
        );
        if (result._tag === "Failure") throw squashAtomCommandFailure(result);
        const connection = appAtomRegistry.get(
          environmentSession.preparedConnectionValueAtom(environmentId),
        );
        const url = Option.isSome(connection)
          ? resolveAssetUrl(connection.value.httpBaseUrl, result.value.relativeUrl)
          : null;
        if (url === null) throw new Error("The environment is not connected.");
        return url;
      },
      upload: async ({ url, uri, mimeType, signal }) => {
        const { status, body } = await new File(uri).upload(url, {
          httpMethod: "POST",
          uploadType: UploadType.BINARY_CONTENT,
          headers: { "Content-Type": mimeType },
          signal,
        });
        return { status, body };
      },
    },
  });
}

/** Sends the words the user respelled in dictated text so the environment can learn them. */
export async function learnFromSentMessage(input: {
  readonly environmentId: EnvironmentId;
  readonly dictated: ReadonlyArray<string>;
  readonly sent: string;
}): Promise<void> {
  const corrections = findDictationCorrections({ dictated: input.dictated, sent: input.sent });
  if (corrections.length === 0) return;
  await runAtomCommand(
    appAtomRegistry,
    voiceEnvironment.learnCorrections,
    { environmentId: input.environmentId, input: { corrections } },
    { reportFailure: false },
  );
}
