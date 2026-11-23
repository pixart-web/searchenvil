const { spawnSync } = require("node:child_process");
const path = require("node:path");
const { writeFileSync } = require("node:fs");
const phases = [];
const root = path.resolve(__dirname, "../../..");

function run(name, executable, args, env = process.env) {
  const result = spawnSync(executable, args, {
    cwd: root,
    env,
    stdio: "inherit",
    timeout: 240_000,
    killSignal: "SIGTERM",
  });
  phases.push({
    name,
    status: result.status === 0 ? "passed" : "failed",
    exitCode: result.status,
    error: result.error?.message,
  });
}

run("lint", "pnpm", ["lint"]);
run("typecheck", "pnpm", ["typecheck"]);
run("desktop gateway", "pnpm", ["--filter", "@searchanvil/desktop", "test"]);
const native = process.env.SEARCHANVIL_QA_REPOSITORY_NATIVE;
if (native) {
  run("repository tests and API E2E on disposable services", "bash", [
    "apps/desktop/scripts/qa-repository.sh",
    path.resolve(native),
  ]);
} else {
  phases.push({
    name: "repository tests and API E2E on disposable services",
    status: "skipped",
    reason: "Provide SEARCHANVIL_QA_REPOSITORY_NATIVE with PostgreSQL and Redis binaries.",
  });
}
const app = process.env.SEARCHANVIL_QA_EXECUTABLE;
if (process.platform === "darwin" && app) {
  const scripts = "apps/desktop/scripts";
  const runtime = path.resolve(path.dirname(app), "../Resources/runtime");
  run("runtime integration", process.execPath, [`${scripts}/smoke-runtime.cjs`, runtime]);
  run("installed Electron workflows", process.execPath, [`${scripts}/smoke-electron.cjs`, app]);
  run("forced parent exit", process.execPath, [`${scripts}/qa-forced-exit.cjs`, app]);
  if (process.env.SEARCHANVIL_QA_LIVE_RECOVERY === "1") {
    run("live pipeline recovery checkpoints", process.execPath, [
      `${scripts}/live-recovery.cjs`,
      runtime,
    ]);
    run("startup port contention", process.execPath, [
      `${scripts}/qa-port-contention.cjs`,
      runtime,
    ]);
    run("immediate relaunch", process.execPath, [`${scripts}/qa-forced-exit.cjs`, app], {
      ...process.env,
      SEARCHANVIL_QA_IMMEDIATE: "1",
    });
  }
} else {
  phases.push({
    name: "installed macOS checks",
    status: "skipped",
    reason: "Provide SEARCHANVIL_QA_EXECUTABLE on macOS.",
  });
}
const report = { phases };
if (process.env.SEARCHANVIL_QA_RESULTS)
  writeFileSync(process.env.SEARCHANVIL_QA_RESULTS, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report));
process.exitCode = phases.some(({ status }) => status === "failed") ? 1 : 0;
