#!/usr/bin/env node
const fs = require("node:fs"),
  path = require("node:path"),
  { spawnSync } = require("node:child_process");
const { ROOT } = require("./balance-lib.cjs");
const [command = "setup", target = "linux", format = "dir"] =
    process.argv.slice(2),
  runtime = path.join(ROOT, "node_modules/electron/dist");
const env = {
  ...process.env,
  NODE_USE_ENV_PROXY: "1",
  electron_config_cache: path.join(ROOT, "node_modules/.cache/electron"),
  ELECTRON_BUILDER_CACHE: path.join(
    ROOT,
    "node_modules/.cache/electron-builder",
  ),
};
function run(script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: ROOT,
    env,
    stdio: "inherit",
  });
  if (result.status !== 0)
    throw Error(
      "Command failed: " +
        path.basename(script) +
        " (exit " +
        result.status +
        "). If the runtime download is blocked, install dependencies on a connected build machine.",
    );
}
try {
  if (command === "setup") {
    run(require.resolve("electron/install.js"));
    console.log("Electron runtime is installed.");
  } else if (command === "package") {
    if (!["linux", "win"].includes(target) || !["dir", "zip"].includes(format))
      throw Error("Usage: desktop.cjs package linux|win dir|zip");
    run(path.join(ROOT, "tools/build.cjs"));
    const args = [
      "--config",
      "desktop/electron-builder.cjs",
      "--" + target,
      ...(format === "dir" ? ["--dir"] : ["zip"]),
      "--x64",
    ];
    if (target === "linux" && fs.existsSync(path.join(runtime, "electron")))
      args.push("--config.electronDist=" + runtime);
    run(require.resolve("electron-builder/cli"), args);
  } else throw Error("Unknown desktop command " + command);
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
