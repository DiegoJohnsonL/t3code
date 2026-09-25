import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Queue from "effect/Queue";
import * as Scope from "effect/Scope";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import { ChildProcessSpawner } from "effect/unstable/process";

import * as ServerSecretStore from "../auth/ServerSecretStore.ts";
import * as ServerConfig from "../config.ts";
import { SqlitePersistenceMemory } from "../persistence/Layers/Sqlite.ts";
import * as ServerSettings from "../serverSettings.ts";
import * as ServeMode from "./ServeMode.ts";

const settingsLayer = () =>
  ServerSettings.layer.pipe(
    Layer.provide(ServerSecretStore.layer),
    Layer.provideMerge(Layer.fresh(SqlitePersistenceMemory)),
    Layer.provideMerge(
      Layer.fresh(ServerConfig.layerTest(process.cwd(), { prefix: "t3code-serve-mode-test-" })),
    ),
  );

type ProcessEvent =
  | { readonly type: "started"; readonly argv: string }
  | { readonly type: "stopped" };

const recordingSpawner = (events: Queue.Queue<ProcessEvent>) =>
  ChildProcessSpawner.make((command) =>
    Effect.gen(function* () {
      if (command._tag !== "StandardCommand") return yield* Effect.die("unexpected pipeline");
      yield* Effect.addFinalizer(() => Queue.offer(events, { type: "stopped" }));
      yield* Queue.offer(events, {
        type: "started",
        argv: [command.command, ...command.args].join(" "),
      });
      return ChildProcessSpawner.makeHandle({
        pid: ChildProcessSpawner.ProcessId(1),
        exitCode: Effect.never,
        isRunning: Effect.succeed(true),
        kill: () => Effect.void,
        unref: Effect.succeed(Effect.void),
        stdin: Sink.drain,
        stdout: Stream.empty,
        stderr: Stream.empty,
        all: Stream.empty,
        getInputFd: () => Sink.drain,
        getOutputFd: () => Stream.empty,
      });
    }),
  );

const startServeMode = Effect.fn(function* (platform: ServeMode.ServeModeHost["platform"]) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const events = yield* Queue.unbounded<ProcessEvent>();
  const requestDir = path.join(yield* fs.makeTempDirectoryScoped(), "requests");
  const requestPath = path.join(requestDir, String(process.pid));
  const serveModeScope = yield* Scope.make();
  yield* ServeMode.make(platform === "darwin" ? { platform, requestDir } : { platform }).pipe(
    Scope.provide(serveModeScope),
    Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, recordingSpawner(events)),
  );
  return {
    events,
    requestExists: fs.exists(requestPath),
    stop: Scope.close(serveModeScope, Exit.void),
  };
});

it.layer(NodeServices.layer)("serve mode", (it) => {
  it.effect("holds caffeinate and a helper request only while serve mode is on", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const settings = yield* ServerSettings.ServerSettingsService;
        const serveMode = yield* startServeMode("darwin");
        assert.isFalse(yield* serveMode.requestExists);

        yield* settings.updateSettings({ serveMode: true });
        assert.deepStrictEqual(yield* Queue.take(serveMode.events), {
          type: "started",
          argv: `/usr/bin/caffeinate -i -w ${process.pid}`,
        });
        assert.isTrue(yield* serveMode.requestExists);

        yield* settings.updateSettings({ serveMode: false });
        assert.deepStrictEqual(yield* Queue.take(serveMode.events), { type: "stopped" });
        yield* serveMode.stop;
        assert.isFalse(yield* serveMode.requestExists);
        assert.strictEqual(yield* Queue.size(serveMode.events), 0);
      }),
    ).pipe(Effect.provide(settingsLayer())),
  );

  it.effect("starts when the server starts with serve mode on and stops with the server", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const settings = yield* ServerSettings.ServerSettingsService;
        yield* settings.updateSettings({ serveMode: true });
        const serveMode = yield* startServeMode("darwin");

        assert.strictEqual((yield* Queue.take(serveMode.events)).type, "started");
        yield* serveMode.stop;
        assert.deepStrictEqual(yield* Queue.take(serveMode.events), { type: "stopped" });
        assert.isFalse(yield* serveMode.requestExists);
      }),
    ).pipe(Effect.provide(settingsLayer())),
  );

  it.effect("holds a PowerShell execution-state request on Windows while serve mode is on", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const settings = yield* ServerSettings.ServerSettingsService;
        const serveMode = yield* startServeMode("win32");

        yield* settings.updateSettings({ serveMode: true });
        const started = yield* Queue.take(serveMode.events);
        assert(started.type === "started");
        const [command, ...args] = started.argv.split(" ");
        assert.strictEqual(command, "powershell.exe");
        assert.deepStrictEqual(args.slice(0, 3), [
          "-NoProfile",
          "-NonInteractive",
          "-EncodedCommand",
        ]);
        const script = Buffer.from(args[3] ?? "", "base64").toString("utf16le");
        assert.include(script, "SetThreadExecutionState(2147483649)");
        assert.include(script, `Wait-Process -Id ${process.pid}`);
        assert.isFalse(yield* serveMode.requestExists);

        yield* settings.updateSettings({ serveMode: false });
        assert.deepStrictEqual(yield* Queue.take(serveMode.events), { type: "stopped" });
        yield* serveMode.stop;
      }),
    ).pipe(Effect.provide(settingsLayer())),
  );
});
