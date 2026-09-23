import * as NodeCrypto from "node:crypto";

import {
  type CustomBackgroundImageId,
  CustomBackgroundImageId as CustomBackgroundImageIdSchema,
  PHONE_BACKGROUND_IMAGE_MAX_BYTES,
  type PhoneBackgroundPrepareImagesInput,
  PhoneBackgroundStoreError,
} from "@t3tools/contracts";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";

import {
  base64UrlDecodeUtf8,
  base64UrlEncode,
  signPayload,
  timingSafeEqualBase64Url,
} from "../auth/utils.ts";
import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ServerConfig from "../config.ts";

export const PHONE_BACKGROUND_UPLOAD_ROUTE_PREFIX = "/api/phone-background/upload";

const UPLOAD_URL_TTL_MS = 10 * 60_000;
// Asset download tokens share this key; the claim kind keeps the grants apart.
const SIGNING_SECRET_NAME = "asset-access-signing-key";

/** Formats both phones decode natively. The file extension records which one a picture holds. */
const EXTENSION_BY_MIME_TYPE: Readonly<Record<string, string>> = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};
const MIME_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(EXTENSION_BY_MIME_TYPE).map(([mimeType, extension]) => [extension, mimeType]),
);

const UploadClaims = Schema.Struct({
  version: Schema.Literal(1),
  kind: Schema.Literal("phone-background-upload"),
  imageId: CustomBackgroundImageIdSchema,
  expiresAt: Schema.Finite,
});
type UploadClaims = typeof UploadClaims.Type;

const uploadClaimsJson = Schema.fromJsonString(UploadClaims);
const decodeUploadClaims = Schema.decodeUnknownOption(uploadClaimsJson);
const encodeUploadClaims = Schema.encodeSync(uploadClaimsJson);
const isImageId = Schema.is(CustomBackgroundImageIdSchema);

function decodeClaims(payload: string): UploadClaims | null {
  try {
    return Option.getOrNull(decodeUploadClaims(base64UrlDecodeUtf8(payload)));
  } catch {
    return null;
  }
}

const loadSigningSecret = Effect.gen(function* () {
  const secretStore = yield* ServerSecretStore.ServerSecretStore;
  return yield* secretStore.getOrCreateRandom(SIGNING_SECRET_NAME, 32);
});

const storeDirectory = Effect.gen(function* () {
  const config = yield* ServerConfig.ServerConfig;
  const path = yield* Path.Path;
  return path.join(config.stateDir, "phone-backgrounds");
});

function storedImageId(entry: string): CustomBackgroundImageId | null {
  const dot = entry.indexOf(".");
  const imageId = entry.slice(0, dot);
  return dot > 0 && entry.slice(dot) in MIME_TYPE_BY_EXTENSION && isImageId(imageId)
    ? imageId
    : null;
}

/**
 * Signs an upload for every picture the store lacks and drops every stored
 * picture the next background no longer uses, so the store only ever holds
 * one background's worth of images.
 */
export const preparePhoneBackgroundImages = Effect.fn("PhoneBackgroundImages.prepareImages")(
  function* (input: PhoneBackgroundPrepareImagesInput) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const directory = yield* storeDirectory;
    yield* fileSystem.makeDirectory(directory, { recursive: true });

    const wanted = new Set(input.imageIds);
    const stored = new Set<CustomBackgroundImageId>();
    for (const entry of yield* fileSystem.readDirectory(directory)) {
      // In-flight uploads rename their part file into place, and failed ones remove it.
      if (entry.endsWith(".part")) continue;
      const imageId = storedImageId(entry);
      if (imageId !== null && wanted.has(imageId)) {
        stored.add(imageId);
      } else {
        yield* fileSystem.remove(path.join(directory, entry), { force: true });
      }
    }

    const secret = yield* loadSigningSecret;
    const expiresAt = (yield* Clock.currentTimeMillis) + UPLOAD_URL_TTL_MS;
    return {
      uploads: [...wanted]
        .filter((imageId) => !stored.has(imageId))
        .map((imageId) => {
          const payload = base64UrlEncode(
            encodeUploadClaims({ version: 1, kind: "phone-background-upload", imageId, expiresAt }),
          );
          return {
            imageId,
            relativeUrl: `${PHONE_BACKGROUND_UPLOAD_ROUTE_PREFIX}/${payload}.${signPayload(payload, secret)}`,
          };
        }),
    };
  },
  Effect.mapError((cause) => new PhoneBackgroundStoreError({ cause })),
);

export const validatePhoneBackgroundUploadToken = Effect.fn(
  "PhoneBackgroundImages.validateUploadToken",
)(function* (token: string) {
  const [payload, signature, unexpectedSegment] = token.split(".");
  if (!payload || !signature || unexpectedSegment) return null;

  const secret = yield* loadSigningSecret.pipe(
    Effect.tapError((cause) =>
      Effect.logError("Failed to load the phone background upload signing key.", { cause }),
    ),
    Effect.orElseSucceed(() => null),
  );
  if (!secret || !timingSafeEqualBase64Url(signature, signPayload(payload, secret))) return null;

  const claims = decodeClaims(payload);
  if (!claims || claims.expiresAt <= (yield* Clock.currentTimeMillis)) return null;
  return claims;
});

export type StorePhoneBackgroundUploadResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: number; readonly detail: string };

export const storePhoneBackgroundUpload = Effect.fn("PhoneBackgroundImages.storeUpload")(function* <
  E,
>(input: {
  readonly claims: UploadClaims;
  readonly mimeType: string | undefined;
  readonly body: Stream.Stream<Uint8Array, E>;
}) {
  const extension = EXTENSION_BY_MIME_TYPE[input.mimeType?.split(";", 1)[0]?.trim() ?? ""];
  if (!extension) {
    return {
      ok: false,
      status: 415,
      detail: "Upload a WebP, JPEG, or PNG picture.",
    } satisfies StorePhoneBackgroundUploadResult;
  }

  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* storeDirectory;
  const finalPath = path.join(directory, `${input.claims.imageId}${extension}`);
  const partPath = `${finalPath}.${NodeCrypto.randomUUID()}.part`;
  let receivedBytes = 0;
  return yield* Effect.gen(function* () {
    yield* fileSystem.makeDirectory(directory, { recursive: true });
    yield* Stream.run(
      input.body.pipe(
        Stream.takeWhile((chunk) => {
          receivedBytes += chunk.byteLength;
          return receivedBytes <= PHONE_BACKGROUND_IMAGE_MAX_BYTES;
        }),
      ),
      fileSystem.sink(partPath),
    );
    if (receivedBytes > PHONE_BACKGROUND_IMAGE_MAX_BYTES) {
      return {
        ok: false,
        status: 413,
        detail: "The picture is too large for phones.",
      } satisfies StorePhoneBackgroundUploadResult;
    }
    yield* fileSystem.rename(partPath, finalPath);
    return { ok: true } satisfies StorePhoneBackgroundUploadResult;
  }).pipe(
    Effect.catch((cause) =>
      Effect.logError("Failed to store a phone background picture.", {
        imageId: input.claims.imageId,
        cause,
      }).pipe(
        Effect.as({
          ok: false,
          status: 500,
          detail: "Failed to store the picture.",
        } satisfies StorePhoneBackgroundUploadResult),
      ),
    ),
    Effect.ensuring(fileSystem.remove(partPath, { force: true }).pipe(Effect.ignore)),
  );
});

/** The stored picture for an image id, or null when the store does not hold it. */
export const resolvePhoneBackgroundImage = Effect.fn("PhoneBackgroundImages.resolve")(function* (
  imageId: CustomBackgroundImageId,
) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* storeDirectory;
  for (const [extension, mimeType] of Object.entries(MIME_TYPE_BY_EXTENSION)) {
    const filePath = path.join(directory, `${imageId}${extension}`);
    if (yield* fileSystem.exists(filePath).pipe(Effect.orElseSucceed(() => false))) {
      return { path: filePath, mimeType };
    }
  }
  return null;
});
