import { resolveAssetUrl } from "@t3tools/client-runtime/state/assets";
import {
  createEnvironmentRpcCommand,
  runAtomCommand,
  squashAtomCommandFailure,
} from "@t3tools/client-runtime/state/runtime";
import {
  type CustomBackgroundImageId,
  type EnvironmentId,
  type PhoneBackground,
  WS_METHODS,
} from "@t3tools/contracts";
import * as Option from "effect/Option";
import { CryptoDigestAlgorithm, digest } from "expo-crypto";
import { File, UploadType } from "expo-file-system";

import { connectionAtomRuntime } from "../../connection/runtime";
import { beginForegroundHandoff } from "../../lib/foreground-handoff";
import { appAtomRegistry } from "../../state/atom-registry";
import { serverEnvironment } from "../../state/server";
import { environmentSession } from "../../state/session";
import {
  type AddedPicture,
  phoneBackgroundWithoutPicture,
  phoneBackgroundWithPictures,
  sourceColorFromPixels,
} from "./computerBackground.logic";
import { decodePngPixels } from "./pngPixels";

// The same long edge the desktop uploads, enough to cover a phone screen.
const PICTURE_MAX_EDGE = 1920;
const PICTURE_QUALITY = 0.85;
// Material scores a downscaled wallpaper; this is the desktop's sample size.
const COLOR_SAMPLE_EDGE = 112;

const prepareImages = createEnvironmentRpcCommand(connectionAtomRuntime, {
  label: "environment-command:phone-background:prepare-images",
  tag: WS_METHODS.phoneBackgroundPrepareImages,
});

async function prepareStore(environmentId: EnvironmentId, imageIds: ReadonlyArray<string>) {
  const result = await runAtomCommand(appAtomRegistry, prepareImages, {
    environmentId,
    input: { imageIds },
  });
  if (result._tag === "Failure") throw squashAtomCommandFailure(result);
  return result.value.uploads;
}

async function saveBackground(
  environmentId: EnvironmentId,
  phoneBackground: PhoneBackground | null,
) {
  const result = await runAtomCommand(appAtomRegistry, serverEnvironment.updateSettings, {
    environmentId,
    input: { patch: { phoneBackground } },
  });
  if (result._tag === "Failure") throw squashAtomCommandFailure(result);
}

interface RenderedPicture extends AddedPicture {
  readonly file: File;
}

async function renderPicture(uri: string): Promise<RenderedPicture> {
  const { ImageManipulator, SaveFormat } = await import("expo-image-manipulator");
  const source = await ImageManipulator.manipulate(uri).renderAsync();
  const fit = (edge: number) =>
    source.width >= source.height
      ? { width: Math.min(edge, source.width) }
      : { height: Math.min(edge, source.height) };
  try {
    const full = await ImageManipulator.manipulate(source)
      .resize(fit(PICTURE_MAX_EDGE))
      .renderAsync();
    const saved = await full.saveAsync({ format: SaveFormat.WEBP, compress: PICTURE_QUALITY });
    full.release();
    const sample = await ImageManipulator.manipulate(source)
      .resize(fit(COLOR_SAMPLE_EDGE))
      .renderAsync();
    const sampled = await sample.saveAsync({ format: SaveFormat.PNG, base64: true });
    sample.release();
    const file = new File(saved.uri);
    const hash = new Uint8Array(await digest(CryptoDigestAlgorithm.SHA256, await file.bytes()));
    return {
      file,
      imageId: Array.from(hash, (byte) => byte.toString(16).padStart(2, "0")).join(""),
      sourceColor: sampled.base64
        ? sourceColorFromPixels(
            decodePngPixels(Uint8Array.from(atob(sampled.base64), (char) => char.charCodeAt(0)))
              .rgba,
          )
        : null,
    };
  } finally {
    source.release();
  }
}

async function uploadPicture(
  environmentId: EnvironmentId,
  relativeUrl: string,
  file: File,
): Promise<void> {
  const connection = appAtomRegistry.get(
    environmentSession.preparedConnectionValueAtom(environmentId),
  );
  const url = Option.isSome(connection)
    ? resolveAssetUrl(connection.value.httpBaseUrl, relativeUrl)
    : null;
  if (!url) throw new Error("The computer is not connected.");
  const result = await file.upload(url, {
    httpMethod: "POST",
    uploadType: UploadType.BINARY_CONTENT,
    headers: { "Content-Type": "image/webp" },
  });
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`The computer rejected a picture (${result.status}).`);
  }
}

/**
 * Picks photos and adds them to the computer's shared phone background. Each
 * picture is resized and scored on the phone, so only a 1920px WebP travels.
 * Returns how many pictures were added; zero when the picker was cancelled.
 */
export async function addPhonePictures(input: {
  readonly environmentId: EnvironmentId;
  readonly current: PhoneBackground | null;
}): Promise<number> {
  const imagePicker = await import("expo-image-picker");
  // The picker covers the Android activity, which reports the app as backgrounded.
  const endHandoff = beginForegroundHandoff();
  let picked: Awaited<ReturnType<typeof imagePicker.launchImageLibraryAsync>>;
  try {
    picked = await imagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      base64: false,
      quality: 1,
      shouldDownloadFromNetwork: true,
    });
  } finally {
    endHandoff();
  }
  if (picked.canceled || picked.assets.length === 0) return 0;

  const pictures: RenderedPicture[] = [];
  try {
    for (const asset of picked.assets) pictures.push(await renderPicture(asset.uri));
    const next = phoneBackgroundWithPictures(input.current, pictures, new Date().toISOString());
    const uploads = await prepareStore(
      input.environmentId,
      next.record.source.kind === "image" ? next.record.source.imageIds : [],
    );
    for (const upload of uploads) {
      const picture = pictures.find((candidate) => candidate.imageId === upload.imageId);
      if (picture) await uploadPicture(input.environmentId, upload.relativeUrl, picture.file);
    }
    await saveBackground(input.environmentId, next);
    return pictures.length;
  } finally {
    for (const picture of pictures) if (picture.file.exists) picture.file.delete();
  }
}

/** Removes one picture from the shared background and from the computer's store. */
export async function removePhonePicture(input: {
  readonly environmentId: EnvironmentId;
  readonly current: PhoneBackground;
  readonly imageId: CustomBackgroundImageId;
}): Promise<void> {
  const next = phoneBackgroundWithoutPicture(input.current, input.imageId);
  await saveBackground(input.environmentId, next);
  await prepareStore(
    input.environmentId,
    next?.record.source.kind === "image" ? next.record.source.imageIds : [],
  );
}

export async function setPhoneImageColors(input: {
  readonly environmentId: EnvironmentId;
  readonly current: PhoneBackground;
  readonly dynamicTheme: boolean;
}): Promise<void> {
  await saveBackground(input.environmentId, { ...input.current, dynamicTheme: input.dynamicTheme });
}
