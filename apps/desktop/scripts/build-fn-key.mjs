import * as NodeChildProcess from "node:child_process";
import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import * as NodeUtil from "node:util";

// oxlint-disable-next-line t3code/no-global-process-runtime -- The native compiler targets the actual host; this script has no Effect runtime.
const hostArch = process.arch;
// oxlint-disable-next-line t3code/no-global-process-runtime -- Native compilation only runs on the actual macOS host.
const hostPlatform = process.platform;

const { values } = NodeUtil.parseArgs({
  options: { output: { type: "string" }, arch: { type: "string", default: hostArch } },
});

if (hostPlatform === "darwin") {
  const clangArchs = { arm64: ["arm64"], x64: ["x86_64"], universal: ["arm64", "x86_64"] }[
    values.arch
  ];
  if (clangArchs === undefined) throw new Error(`Unsupported macOS architecture: ${values.arch}`);
  const root = NodeURL.fileURLToPath(new URL("../../../native/fn-key/", import.meta.url));
  const source = NodePath.resolve(root, "fn_key.mm");
  const output = values.output ?? NodePath.resolve(root, "build", values.arch, "t3-fn-key.node");
  // N-API is ABI-stable, so the running Node's headers build an addon Electron loads too.
  const nodeHeaders = NodePath.resolve(process.execPath, "../../include/node");
  if (!NodeFS.existsSync(NodePath.join(nodeHeaders, "node_api.h"))) {
    throw new Error(`Building the macOS fn key addon needs Node's headers at ${nodeHeaders}.`);
  }
  const containsArchitectures = (file) =>
    NodeChildProcess.spawnSync("lipo", [file, "-verify_arch", ...clangArchs]).status === 0;
  let current = false;
  try {
    current =
      NodeFS.statSync(output).mtimeMs >=
        Math.max(
          NodeFS.statSync(source).mtimeMs,
          NodeFS.statSync(NodeURL.fileURLToPath(import.meta.url)).mtimeMs,
        ) && containsArchitectures(output);
  } catch {
    /* The first build has no output yet. */
  }
  if (!current) {
    NodeFS.mkdirSync(NodePath.dirname(output), { recursive: true });
    const temporary = `${output}.${process.pid}.tmp`;
    try {
      NodeChildProcess.execFileSync(
        process.env.CXX || "clang++",
        [
          ...clangArchs.flatMap((arch) => ["-arch", arch]),
          // Electron 44's minimum macOS version.
          "-mmacosx-version-min=13.0",
          "-std=c++17",
          "-O2",
          "-Wall",
          "-Wextra",
          "-Werror",
          "-fobjc-arc",
          "-shared",
          "-undefined",
          "dynamic_lookup",
          "-framework",
          "AppKit",
          "-I",
          nodeHeaders,
          source,
          "-o",
          temporary,
        ],
        { stdio: "inherit" },
      );
      NodeFS.renameSync(temporary, output);
    } finally {
      NodeFS.rmSync(temporary, { force: true });
    }
  }
}
