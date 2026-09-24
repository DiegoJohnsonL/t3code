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

/**
 * While `serveMode` is on, holds `caffeinate -i`, which stops idle sleep
 * but still lets the display sleep and lock. `-w` ends it with this server
 * even if the server is killed before its finalizers run.
 */
export const make = Effect.fn("background.serveMode.make")(function* (options: {
  readonly requestDir: string;
}) {
  const settings = yield* ServerSettingsService;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const requestPath = path.join(options.requestDir, String(process.pid));

  const serve = Effect.gen(function* () {
    yield* Effect.acquireRelease(
      fs
        .makeDirectory(options.requestDir, { recursive: true })
        .pipe(Effect.andThen(fs.writeFileString(requestPath, ""))),
      () => fs.remove(requestPath, { force: true }).pipe(Effect.ignore),
    ).pipe(Effect.ignoreCause({ log: true }));
    yield* spawner
      .spawn(
        ChildProcess.make("/usr/bin/caffeinate", ["-i", "-w", String(process.pid)], {
          stdin: "ignore",
          stdout: "ignore",
          stderr: "ignore",
        }),
      )
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
    if ((yield* HostProcessPlatform) !== "darwin") return;
    yield* make({ requestDir: SERVE_MODE_REQUEST_DIR });
  }),
);
