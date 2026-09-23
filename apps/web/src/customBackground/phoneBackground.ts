import {
  type CustomBackgroundRecord,
  type EnvironmentId,
  type PhoneBackground,
  WS_METHODS,
} from "@t3tools/contracts";
import { resolveAssetUrl } from "@t3tools/client-runtime/state/assets";
import {
  createEnvironmentRpcCommand,
  runAtomCommand,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";

import { connectionAtomRuntime } from "~/connection/runtime";
import { appAtomRegistry } from "~/rpc/atomRegistry";
import { readPreparedConnection } from "~/state/session";

import { readBackgroundImage, type StoredBackgroundImage } from "./imageStore";

const prepareImages = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:phone-background:prepare-images",
  tag: WS_METHODS.phoneBackgroundPrepareImages,
});

async function preparePhoneImages(environmentId: EnvironmentId, imageIds: ReadonlyArray<string>) {
  const result = await runAtomCommand(appAtomRegistry, prepareImages, {
    environmentId,
    input: { imageIds },
  });
  if (result._tag === "Failure") throw squashAtomCommandFailure(result);
  return result.value.uploads;
}

async function uploadPicture(input: {
  readonly environmentId: EnvironmentId;
  readonly relativeUrl: string;
  readonly image: StoredBackgroundImage;
}): Promise<void> {
  const connection = readPreparedConnection(input.environmentId);
  const url = connection ? resolveAssetUrl(connection.httpBaseUrl, input.relativeUrl) : null;
  if (!url) throw new Error("This computer is not connected to its T3 Code server.");
  // Phones get the 1920px rendition; the 4K original would only cost them bandwidth.
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": input.image.shader.type },
    body: input.image.shader,
  });
  if (!response.ok) throw new Error(`The server rejected a picture (${response.status}).`);
}

/**
 * Copies a playlist to the shared phone background once; phones may edit it
 * afterwards. Pictures upload before the record lands, so a phone never gets
 * a background pointing at a picture it cannot load yet. Clearing publishes
 * first and then empties the store for the same reason.
 */
export async function publishPhoneBackground(input: {
  readonly environmentId: EnvironmentId;
  readonly record: CustomBackgroundRecord | null;
  readonly dynamicTheme: boolean;
  readonly publish: (background: PhoneBackground | null) => void;
}): Promise<void> {
  if (input.record?.source.kind !== "image") {
    input.publish(null);
    await preparePhoneImages(input.environmentId, []);
    return;
  }

  const images = (await Promise.all(input.record.source.imageIds.map(readBackgroundImage))).filter(
    (image): image is StoredBackgroundImage => image !== null,
  );
  const uploads = await preparePhoneImages(
    input.environmentId,
    images.map((image) => image.id),
  );
  await Promise.all(
    uploads.map((upload) =>
      uploadPicture({
        environmentId: input.environmentId,
        relativeUrl: upload.relativeUrl,
        image: images.find((image) => image.id === upload.imageId)!,
      }),
    ),
  );
  input.publish({
    record: input.record,
    dynamicTheme: input.dynamicTheme,
    sourceColors: Object.fromEntries(
      images.flatMap((image) =>
        image.sourceColor === null ? [] : [[image.id, image.sourceColor]],
      ),
    ),
  });
}
