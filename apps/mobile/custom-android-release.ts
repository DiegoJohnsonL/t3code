import type { ExpoConfig } from "expo/config";

// Google Play's ceiling; Android itself accepts any positive 32-bit integer.
const MAX_ANDROID_VERSION_CODE = 2_100_000_000;

/**
 * Turns the build into this fork's sideloaded Android release when
 * `T3CODE_ANDROID_UPDATE_RELEASES_URL` points at the GitHub releases API
 * listing its APKs. Lives outside app.config.ts so upstream merges stay clean.
 */
export function withCustomAndroidRelease(
  config: ExpoConfig,
  env: Readonly<Record<string, string | undefined>>,
): ExpoConfig {
  const releasesUrl = env.T3CODE_ANDROID_UPDATE_RELEASES_URL?.trim();
  if (!releasesUrl) return config;

  if (!URL.canParse(releasesUrl) || !/^https?:$/.test(new URL(releasesUrl).protocol)) {
    throw new Error("T3CODE_ANDROID_UPDATE_RELEASES_URL must be an http(s) URL.");
  }
  const versionCode = Number(env.T3CODE_ANDROID_VERSION_CODE);
  if (
    !Number.isSafeInteger(versionCode) ||
    versionCode < 1 ||
    versionCode > MAX_ANDROID_VERSION_CODE
  ) {
    throw new Error(
      `T3CODE_ANDROID_VERSION_CODE must be an integer from 1 to ${MAX_ANDROID_VERSION_CODE}.`,
    );
  }
  const versionName = env.T3CODE_ANDROID_VERSION_NAME?.trim();
  if (!versionName) {
    throw new Error("T3CODE_ANDROID_VERSION_NAME is required for a custom Android release.");
  }

  return {
    ...config,
    version: versionName,
    // Upstream's over-the-air bundles must never replace the fork's JavaScript.
    updates: { ...config.updates, enabled: false },
    android: {
      ...config.android,
      versionCode,
      permissions: [
        ...(config.android?.permissions ?? []),
        "android.permission.REQUEST_INSTALL_PACKAGES",
      ],
    },
    extra: { ...config.extra, apkUpdates: { releasesUrl } },
  };
}
