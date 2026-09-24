import * as NodeServices from "@effect/platform-node/NodeServices";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";

import * as DesktopConfig from "../app/DesktopConfig.ts";
import * as DesktopEnvironment from "../app/DesktopEnvironment.ts";
import * as DesktopDictationKey from "./DesktopDictationKey.ts";

it.layer(NodeServices.layer)("fn key addon path", (it) => {
  it.effect("finds development and packaged addons without falling back outside the install", () =>
    Effect.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "t3-fn-key-path-" });
      const resourcesPath = path.join(root, "install", "resources");
      const native = path.join(root, "native", "fn-key", "build", "arm64", "t3-fn-key.node");
      const staged = path.join(
        root,
        "apps",
        "desktop",
        "prod-resources",
        "fn-key",
        "t3-fn-key.node",
      );
      const packaged = path.join(resourcesPath, "fn-key", "t3-fn-key.node");
      for (const filename of [native, staged, packaged]) {
        yield* fileSystem.makeDirectory(path.dirname(filename), { recursive: true });
        yield* fileSystem.writeFileString(filename, "addon");
      }
      const resolve = (isPackaged: boolean, platform: NodeJS.Platform = "darwin") => {
        const environment = DesktopEnvironment.layer({
          dirname: path.join(root, "apps", "desktop", "dist-electron"),
          homeDirectory: root,
          platform,
          processArch: "arm64",
          appVersion: "0.0.1",
          appPath: path.join(resourcesPath, "app.asar"),
          isPackaged,
          resourcesPath,
          runningUnderArm64Translation: false,
        }).pipe(Layer.provide(DesktopConfig.layerTest({})));
        return DesktopDictationKey.resolveFnKeyAddonPath.pipe(
          Effect.map(Option.getOrUndefined),
          Effect.provide(environment),
        );
      };

      assert.equal(yield* resolve(false), native);
      assert.equal(yield* resolve(true), packaged);
      yield* fileSystem.remove(native);
      assert.equal(yield* resolve(false), staged);
      yield* fileSystem.remove(packaged);
      assert.isUndefined(yield* resolve(true));
      assert.isUndefined(yield* resolve(false, "linux"));
      assert.isUndefined(yield* resolve(false, "win32"));
      yield* fileSystem.remove(staged);
      assert.isUndefined(yield* resolve(false));
    }).pipe(Effect.scoped),
  );
});
