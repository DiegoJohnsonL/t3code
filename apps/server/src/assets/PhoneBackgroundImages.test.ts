import * as NodeServices from "@effect/platform-node/NodeServices";
import { PHONE_BACKGROUND_IMAGE_MAX_BYTES } from "@t3tools/contracts";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ServerConfig from "../config.ts";
import {
  preparePhoneBackgroundImages,
  PHONE_BACKGROUND_UPLOAD_ROUTE_PREFIX,
  resolvePhoneBackgroundImage,
  storePhoneBackgroundUpload,
  validatePhoneBackgroundUploadToken,
} from "./PhoneBackgroundImages.ts";

const testLayer = ServerSecretStore.layer.pipe(
  Layer.provideMerge(ServerConfig.layerTest(process.cwd(), { prefix: "t3-phone-background-" })),
  Layer.provideMerge(NodeServices.layer),
);

const first = "a".repeat(64);
const second = "b".repeat(64);
const third = "c".repeat(64);

const claimsFor = Effect.fn("claimsFor")(function* (relativeUrl: string) {
  const claims = yield* validatePhoneBackgroundUploadToken(
    relativeUrl.slice(`${PHONE_BACKGROUND_UPLOAD_ROUTE_PREFIX}/`.length),
  );
  expect(claims).not.toBeNull();
  return claims!;
});

const upload = Effect.fn("upload")(function* (
  relativeUrl: string,
  mimeType: string,
  bytes: Uint8Array,
) {
  return yield* storePhoneBackgroundUpload({
    claims: yield* claimsFor(relativeUrl),
    mimeType,
    body: Stream.make(bytes),
  });
});

describe("PhoneBackgroundImages", () => {
  it.effect("uploads only missing pictures and drops the ones a new background stops using", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const issued = yield* preparePhoneBackgroundImages({ imageIds: [first, second] });
      expect(issued.uploads.map((entry) => entry.imageId)).toEqual([first, second]);

      for (const entry of issued.uploads) {
        expect(yield* upload(entry.relativeUrl, "image/webp", new Uint8Array([1, 2, 3]))).toEqual({
          ok: true,
        });
      }
      const stored = yield* resolvePhoneBackgroundImage(first);
      expect(stored?.mimeType).toBe("image/webp");
      expect([...(yield* fileSystem.readFile(stored!.path))]).toEqual([1, 2, 3]);

      const again = yield* preparePhoneBackgroundImages({ imageIds: [second, third] });
      expect(again.uploads.map((entry) => entry.imageId)).toEqual([third]);
      expect(yield* resolvePhoneBackgroundImage(first)).toBeNull();
      expect(yield* resolvePhoneBackgroundImage(second)).not.toBeNull();

      yield* preparePhoneBackgroundImages({ imageIds: [] });
      expect(yield* resolvePhoneBackgroundImage(second)).toBeNull();
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("rejects formats phones cannot decode and pictures over the size limit", () =>
    Effect.gen(function* () {
      const [entry] = (yield* preparePhoneBackgroundImages({ imageIds: [first] })).uploads;

      expect(yield* upload(entry!.relativeUrl, "image/heic", new Uint8Array([1]))).toMatchObject({
        ok: false,
        status: 415,
      });
      expect(
        yield* upload(
          entry!.relativeUrl,
          "image/jpeg",
          new Uint8Array(PHONE_BACKGROUND_IMAGE_MAX_BYTES + 1),
        ),
      ).toMatchObject({ ok: false, status: 413 });
      expect(yield* resolvePhoneBackgroundImage(first)).toBeNull();
    }).pipe(Effect.provide(testLayer)),
  );

  it.effect("rejects tampered upload tokens", () =>
    Effect.gen(function* () {
      const [entry] = (yield* preparePhoneBackgroundImages({ imageIds: [first] })).uploads;
      const token = entry!.relativeUrl.slice(`${PHONE_BACKGROUND_UPLOAD_ROUTE_PREFIX}/`.length);
      const [payload, signature] = token.split(".");

      expect(yield* validatePhoneBackgroundUploadToken(`${payload}x.${signature}`)).toBeNull();
      expect(yield* validatePhoneBackgroundUploadToken(`${token}.extra`)).toBeNull();
    }).pipe(Effect.provide(testLayer)),
  );
});
