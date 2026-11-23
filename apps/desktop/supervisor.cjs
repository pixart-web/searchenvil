const { startRuntime } = require("./runtime.cjs");

let starting;
let stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;
  try {
    const runtime = await starting;
    await runtime?.stop();
    process.exitCode = 0;
  } catch {
    process.exitCode = 1;
  } finally {
    if (process.connected) process.disconnect();
  }
}

function fail(error) {
  if (process.connected)
    process.send({ type: "failure", message: error.message }, () => void shutdown());
  else void shutdown();
}

process.on("disconnect", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
process.once("message", ({ resources, data }) => {
  process.on("message", (message) => {
    if (message.type === "stop") void shutdown();
  });
  starting = startRuntime(resources, data, fail);
  starting.then((runtime) => {
    if (process.connected && !stopping) {
      process.send({ type: "ready", origin: runtime.origin, capability: runtime.capability });
    }
  }, fail);
});
