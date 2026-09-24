import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

// oxlint-disable-next-line t3code/no-global-process-runtime -- Native compilation only runs on the actual macOS host.
const hostPlatform = process.platform;

describe.skipIf(hostPlatform !== "darwin")("bundled fn key addon", () => {
  let directory;
  beforeAll(() => {
    directory = NodeFS.mkdtempSync(NodePath.join(NodeOS.tmpdir(), "t3-fn-key-test-"));
  });
  afterAll(() => {
    if (directory) NodeFS.rmSync(directory, { recursive: true, force: true });
  });

  it("builds a universal addon into a staged resource directory that Node can load", () => {
    const output = NodePath.join(directory, "resources", "fn-key", "t3-fn-key.node");
    NodeChildProcess.execFileSync(process.execPath, [
      NodeURL.fileURLToPath(new URL("./build-fn-key.mjs", import.meta.url)),
      "--arch",
      "universal",
      "--output",
      output,
    ]);
    expect(
      NodeChildProcess.execFileSync("lipo", ["-archs", output], { encoding: "utf8" })
        .trim()
        .split(" ")
        .toSorted(),
    ).toEqual(["arm64", "x86_64"]);

    // A child process keeps the event monitor out of the test runner, and its
    // exit proves a running monitor does not hold Node open.
    const probe = NodeChildProcess.spawnSync(
      process.execPath,
      [
        "-e",
        `const addon = require(${JSON.stringify(output)});
        let rejected = false;
        try { addon.start(); } catch (error) { rejected = error instanceof TypeError; }
        addon.start(() => {});
        addon.stop();
        addon.stop();
        addon.start(() => {});
        process.stdout.write(JSON.stringify({ rejected }));`,
      ],
      { encoding: "utf8", timeout: 10_000 },
    );
    expect(probe.status).toBe(0);
    expect(JSON.parse(probe.stdout)).toEqual({ rejected: true });
  });
});
