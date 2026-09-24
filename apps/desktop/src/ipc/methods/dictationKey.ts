import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import * as DesktopDictationKey from "../../dictation/DesktopDictationKey.ts";
import * as MacFnKeySetup from "../../dictation/MacFnKeySetup.ts";
import * as ElectronWindow from "../../electron/ElectronWindow.ts";
import * as IpcChannels from "../channels.ts";
import * as DesktopIpc from "../DesktopIpc.ts";

export const setDictationKeyEnabled = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.SET_DICTATION_KEY_ENABLED_CHANNEL,
  payload: Schema.Boolean,
  result: Schema.Void,
  handler: Effect.fn("desktop.ipc.dictationKey.setEnabled")(function* (enabled, event) {
    const window = yield* (yield* ElectronWindow.ElectronWindow).main;
    if (
      event === undefined ||
      Option.isNone(window) ||
      window.value.isDestroyed() ||
      window.value.webContents.id !== event.sender.id
    ) {
      return;
    }
    const dictationKey = yield* DesktopDictationKey.DesktopDictationKey;
    yield* dictationKey.setEnabled({ window: window.value, enabled });
  }),
});

const DesktopFnKeySetupSchema = Schema.Literals(["ready", "needs-setup"]);

export const readFnKeySetup = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.READ_FN_KEY_SETUP_CHANNEL,
  payload: Schema.Undefined,
  result: DesktopFnKeySetupSchema,
  handler: Effect.fn("desktop.ipc.dictationKey.readFnKeySetup")(function* () {
    return yield* (yield* MacFnKeySetup.MacFnKeySetup).read;
  }),
});

export const applyFnKeySetup = DesktopIpc.makeIpcMethod({
  channel: IpcChannels.APPLY_FN_KEY_SETUP_CHANNEL,
  payload: Schema.Undefined,
  result: DesktopFnKeySetupSchema,
  handler: Effect.fn("desktop.ipc.dictationKey.applyFnKeySetup")(function* (_payload, event) {
    const fnKeySetup = yield* MacFnKeySetup.MacFnKeySetup;
    const window = yield* (yield* ElectronWindow.ElectronWindow).main;
    if (
      event === undefined ||
      Option.isNone(window) ||
      window.value.webContents.id !== event.sender.id
    ) {
      return yield* fnKeySetup.read;
    }
    return yield* fnKeySetup.apply;
  }),
});
