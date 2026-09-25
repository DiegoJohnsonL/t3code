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

export const WINDOWS_POWER_SAVING_DESCRIPTION =
  "While serve mode is on, switch the PC's Power mode to Best power efficiency. Your previous Power mode comes back when serve mode turns off or T3 Code quits.";
