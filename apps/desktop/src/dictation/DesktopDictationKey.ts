// @effect-diagnostics nodeBuiltinImport:off -- Only Node's require can load the native fn key addon.
import type { DesktopDictationKeyState } from "@t3tools/contracts";
import * as NodeModule from "node:module";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import type * as Electron from "electron";

import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";
import { makeComponentLogger } from "../app/DesktopObservability.ts";
import { DICTATION_KEY_CHANNEL } from "../ipc/channels.ts";

const { logWarning } = makeComponentLogger("desktop-dictation-key");

/** The fn/Globe key monitor built from native/fn-key/fn_key.mm. */
interface FnKeyAddon {
  readonly start: (listener: (state: DesktopDictationKeyState) => void) => void;
  readonly stop: () => void;
}

function isFnKeyAddon(value: unknown): value is FnKeyAddon {
  return (
    typeof value === "object" &&
    value !== null &&
    "start" in value &&
    typeof value.start === "function" &&
    "stop" in value &&
    typeof value.stop === "function"
  );
}

class FnKeyAddonLoadError extends Schema.TaggedError<FnKeyAddonLoadError>()("FnKeyAddonLoadError", {
  path: Schema.String,
  cause: Schema.Defect(),
}) {
  override get message(): string {
    return `Could not load the fn key addon at ${this.path}.`;
  }
}

export class DesktopDictationKey extends Context.Service<
  DesktopDictationKey,
  {
    /**
     * Forwards fn/Globe presses to the window's renderer until disabled, the
     * window closes, or its page navigates. Inert where the key can't be read.
     */
    readonly setEnabled: (input: {
      readonly window: Electron.BrowserWindow;
      readonly enabled: boolean;
    }) => Effect.Effect<void>;
  }
>()("@t3tools/desktop/dictation/DesktopDictationKey") {}

export const resolveFnKeyAddonPath = Effect.gen(function* () {
  const environment = yield* DesktopEnvironment.DesktopEnvironment;
  if (environment.platform !== "darwin") return Option.none<string>();
  const fileSystem = yield* FileSystem.FileSystem;
  const relative = environment.path.join("fn-key", "t3-fn-key.node");
  const candidates = environment.isPackaged
    ? [environment.path.join(environment.resourcesPath, relative)]
    : [
        environment.path.join(
          environment.rootDir,
          "native",
          "fn-key",
          "build",
          environment.processArch,
          "t3-fn-key.node",
        ),
        ...environment.resolveResourcePathCandidates(relative),
      ];
  for (const candidate of candidates) {
    if (yield* fileSystem.exists(candidate).pipe(Effect.orElseSucceed(() => false))) {
      return Option.some(candidate);
    }
  }
  return Option.none<string>();
});

const requireFnKeyAddon = Effect.fn("desktop.dictationKey.requireAddon")(function* (
  addonPath: Option.Option<string>,
) {
  if (Option.isNone(addonPath)) {
    yield* logWarning("fn key addon not found; dictation keeps its keyboard shortcut");
    return Option.none<FnKeyAddon>();
  }
  return yield* Effect.try({
    try: (): unknown => NodeModule.createRequire(import.meta.url)(addonPath.value),
    catch: (cause) => new FnKeyAddonLoadError({ path: addonPath.value, cause }),
  }).pipe(
    Effect.map(Option.liftPredicate(isFnKeyAddon)),
    Effect.catch((error) =>
      logWarning("fn key addon failed to load; dictation keeps its keyboard shortcut", {
        message: error.message,
        cause: error.cause,
      }).pipe(Effect.as(Option.none<FnKeyAddon>())),
    ),
  );
});

export const layer = Layer.effect(
  DesktopDictationKey,
  Effect.gen(function* () {
    const loadAddon = yield* Effect.cached(requireFnKeyAddon(yield* resolveFnKeyAddonPath));
    const watchedContents = new WeakSet<Electron.WebContents>();

    return DesktopDictationKey.of({
      setEnabled: Effect.fn("desktop.dictationKey.setEnabled")(function* ({ window, enabled }) {
        const addon = yield* loadAddon;
        if (Option.isNone(addon)) return;
        const fnKey = addon.value;
        if (!enabled) {
          fnKey.stop();
          return;
        }
        const contents = window.webContents;
        fnKey.start((state) => {
          if (!contents.isDestroyed()) contents.send(DICTATION_KEY_CHANNEL, state);
        });
        if (watchedContents.has(contents)) return;
        watchedContents.add(contents);
        // A reloaded page only turns the key back on if it still offers voice input.
        contents.on("did-navigate", fnKey.stop);
        contents.once("destroyed", fnKey.stop);
      }),
    });
  }),
);
