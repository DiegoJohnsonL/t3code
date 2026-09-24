import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Electron from "electron";

import * as DesktopDictationKey from "../../dictation/DesktopDictationKey.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import { setDictationKeyEnabled } from "./dictationKey.ts";

it.effect("only the main window's renderer can take over the fn key", () => {
  const window = {
    webContents: { id: 7 },
    isDestroyed: () => false,
  } as unknown as Electron.BrowserWindow;
  const calls: Array<{ readonly window: Electron.BrowserWindow; readonly enabled: boolean }> = [];

  return Effect.gen(function* () {
    yield* setDictationKeyEnabled.handler(true, { sender: { id: 8 } });
    yield* setDictationKeyEnabled.handler(true, undefined);
    assert.deepStrictEqual(calls, []);

    yield* setDictationKeyEnabled.handler(true, { sender: { id: 7 } });
    yield* setDictationKeyEnabled.handler(false, { sender: { id: 7 } });
    assert.deepStrictEqual(calls, [
      { window, enabled: true },
      { window, enabled: false },
    ]);
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        Layer.mock(ElectronWindow.ElectronWindow)({
          main: Effect.succeedSome(window),
        }),
        Layer.mock(DesktopDictationKey.DesktopDictationKey)({
          setEnabled: (input) => Effect.sync(() => void calls.push(input)),
        }),
      ),
    ),
  );
});
