import { HostProcessPlatform } from "@t3tools/shared/hostProcess";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";

import { ServerSettingsService } from "../serverSettings.ts";

/**
 * The optional root helper (`scripts/serve-mode`) keeps the Mac running with
 * the lid closed and in Low Power Mode while this directory names a live
 * server pid. Each server writes its own pid, so a crashed server's leftover
 * file reads as stale instead of holding the Mac awake.
 */
export const SERVE_MODE_REQUEST_DIR = "/private/tmp/t3code-serve-mode";

/** Written by `scripts/serve-mode/install.sh`; must match its label. */
export const SERVE_MODE_HELPER_PLIST = "/Library/LaunchDaemons/com.t3tools.t3code.serve-mode.plist";

export type ServeModeHost =
  | { readonly platform: "darwin"; readonly requestDir: string }
  | { readonly platform: "win32" };

/**
 * Windows PowerShell 5.1 ships with every Windows 10 and 11 install. The flags
 * are ES_CONTINUOUS | ES_SYSTEM_REQUIRED in decimal, because 5.1 parses
 * 0x80000001 as a negative Int32 that won't convert to uint. Windows tracks
 * the request per thread, so it ends when this process exits.
 */
const windowsKeepAwakeScript = (serverPid: number) =>
  [
    `$k = Add-Type -Name ServeMode -Namespace T3 -PassThru -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint esFlags);'`,
    `if ($k::SetThreadExecutionState(2147483649) -eq 0) { exit 1 }`,
    `Wait-Process -Id ${serverPid}`,
  ].join("\n");

/**
 * Both commands stop idle sleep but still let the display sleep and lock, and
 * both end with this server even if it is killed before its finalizers run.
 */
export const keepAwakeCommand = (host: ServeModeHost, serverPid: number) => {
  const options = { stdin: "ignore", stdout: "ignore", stderr: "ignore" } as const;
  switch (host.platform) {
    case "darwin":
      return ChildProcess.make("/usr/bin/caffeinate", ["-i", "-w", String(serverPid)], options);
    case "win32":
      return ChildProcess.make(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
          Buffer.from(windowsKeepAwakeScript(serverPid), "utf16le").toString("base64"),
        ],
        options,
      );
  }
};

/** While `serveMode` is on, holds the host's keep-awake process. */
export const make = Effect.fn("background.serveMode.make")(function* (host: ServeModeHost) {
  const settings = yield* ServerSettingsService;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const requestLidClosedHelper = (requestDir: string) => {
    const requestPath = path.join(requestDir, String(process.pid));
    return Effect.acquireRelease(
      fs
        .makeDirectory(requestDir, { recursive: true })
        .pipe(Effect.andThen(fs.writeFileString(requestPath, ""))),
      () => fs.remove(requestPath, { force: true }).pipe(Effect.ignore),
    ).pipe(Effect.ignoreCause({ log: true }));
  };

  const serve = Effect.gen(function* () {
    if (host.platform === "darwin") yield* requestLidClosedHelper(host.requestDir);
    yield* spawner
      .spawn(keepAwakeCommand(host, process.pid))
      .pipe(Effect.ignoreCause({ log: true }));
    return yield* Effect.never;
  }).pipe(Effect.scoped);

  const changes = yield* settings.subscribeChanges;
  const enabledAtStart = yield* settings.getSettings.pipe(
    Effect.map((current) => current.serveMode),
    Effect.orElseSucceed(() => false),
  );
  yield* Stream.concat(
    Stream.make(enabledAtStart),
    changes.pipe(Stream.map((next) => next.serveMode)),
  ).pipe(
    Stream.changes,
    Stream.switchMap((enabled) => (enabled ? Stream.fromEffectDrain(serve) : Stream.empty)),
    Stream.runDrain,
    Effect.forkScoped,
  );
});

export const layer = Layer.effectDiscard(
  Effect.gen(function* () {
    switch (yield* HostProcessPlatform) {
      case "darwin":
        return yield* make({ platform: "darwin", requestDir: SERVE_MODE_REQUEST_DIR });
      case "win32":
        return yield* make({ platform: "win32" });
    }
  }),
);
