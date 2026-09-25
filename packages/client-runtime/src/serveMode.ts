import type { ExecutionEnvironmentPlatformOs } from "@t3tools/contracts";

/** What serve mode calls the computer it keeps awake; null where the server ignores the setting. */
export function serveModeComputerName(os: ExecutionEnvironmentPlatformOs): "Mac" | "PC" | null {
  switch (os) {
    case "darwin":
      return "Mac";
    case "windows":
      return "PC";
    default:
      return null;
  }
}

export const WINDOWS_LID_CLOSED_SETUP =
  "To keep a laptop running with the lid closed while plugged in, set Control Panel → Power Options → Choose what closing the lid does → Plugged in to Do nothing.";
