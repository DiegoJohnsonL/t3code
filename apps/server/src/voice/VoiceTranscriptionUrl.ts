import {
  ThreadId,
  VOICE_TRANSCRIPTION_URL_TTL_MS,
  VoiceTranscriptionSigningKeyError,
  type VoiceTranscriptionCreateUrlInput,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import {
  base64UrlDecodeUtf8,
  base64UrlEncode,
  signPayload,
  timingSafeEqualBase64Url,
} from "../auth/utils.ts";
import * as ServerSecretStore from "../auth/ServerSecretStore.ts";

export const VOICE_TRANSCRIPTION_ROUTE_PREFIX = "/api/voice/transcriptions";

// Shared with asset and attachment tokens; the claim kind keeps them apart.
const SIGNING_SECRET_NAME = "asset-access-signing-key";

const VoiceTranscriptionClaims = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("voice-transcription"),
  mimeType: Schema.String,
  sizeBytes: Schema.Finite,
  threadId: Schema.optionalKey(ThreadId),
  expiresAt: Schema.Finite,
});
export type VoiceTranscriptionClaims = typeof VoiceTranscriptionClaims.Type;

const claimsJson = Schema.fromJsonString(VoiceTranscriptionClaims);
const decodeClaimsJson = Schema.decodeUnknownOption(claimsJson);
const encodeClaimsJson = Schema.encodeSync(claimsJson);

function decodeClaims(encodedPayload: string): VoiceTranscriptionClaims | null {
  try {
    return Option.getOrNull(decodeClaimsJson(base64UrlDecodeUtf8(encodedPayload)));
  } catch {
    return null;
  }
}

const loadSigningSecret = Effect.gen(function* () {
  const secretStore = yield* ServerSecretStore.ServerSecretStore;
  return yield* secretStore.getOrCreateRandom(SIGNING_SECRET_NAME, 32);
});

export const issueVoiceTranscriptionUrl = Effect.fn("VoiceTranscription.issueUrl")(function* (
  input: VoiceTranscriptionCreateUrlInput,
) {
  const secret = yield* loadSigningSecret.pipe(
    Effect.mapError((cause) => new VoiceTranscriptionSigningKeyError({ cause })),
  );
  const expiresAt = (yield* Clock.currentTimeMillis) + VOICE_TRANSCRIPTION_URL_TTL_MS;
  const encodedPayload = base64UrlEncode(
    encodeClaimsJson({
      version: 1,
      kind: "voice-transcription",
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      ...(input.threadId === undefined ? {} : { threadId: input.threadId }),
      expiresAt,
    }),
  );
  return {
    relativeUrl: `${VOICE_TRANSCRIPTION_ROUTE_PREFIX}/${encodedPayload}.${signPayload(encodedPayload, secret)}`,
    expiresAt,
  };
});

export const validateVoiceTranscriptionToken = Effect.fn("VoiceTranscription.validateToken")(
  function* (token: string) {
    const [encodedPayload, signature, unexpectedSegment] = token.split(".");
    if (!encodedPayload || !signature || unexpectedSegment) {
      return null;
    }

    const secret = yield* loadSigningSecret.pipe(
      Effect.tapError((cause) =>
        Effect.logError("Failed to load the voice transcription signing key.", { cause }),
      ),
      Effect.orElseSucceed(() => null),
    );
    if (!secret || !timingSafeEqualBase64Url(signature, signPayload(encodedPayload, secret))) {
      return null;
    }

    const claims = decodeClaims(encodedPayload);
    if (!claims || claims.expiresAt <= (yield* Clock.currentTimeMillis)) {
      return null;
    }
    return claims;
  },
);
