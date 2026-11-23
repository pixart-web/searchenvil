const assert = require("node:assert/strict");
const { mkdtemp } = require("node:fs/promises");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { startRuntime } = require("../runtime.cjs");

async function main() {
  const resources = path.resolve(process.argv[2] ?? path.join(__dirname, "../build/runtime"));
  const data = await mkdtemp(path.join(os.tmpdir(), "anvil-port-qa-"));
  const createServer = net.createServer;
  const blocker = createServer((socket) => socket.destroy());
  let reservations = 0;
  let occupied;
  net.createServer = (...args) => {
    const server = createServer(...args);
    if (++reservations === 3) {
      const close = server.close.bind(server);
      server.close = (callback) => {
        occupied = server.address().port;
        return close(() => blocker.listen(occupied, "127.0.0.1", callback));
      };
    }
    return server;
  };
  let runtime;
  try {
    runtime = await startRuntime(resources, data, (error) => console.error(error.message));
    assert.ok(occupied, "Expected to occupy an allocated interface port");
    assert.ok(reservations >= 6, "Expected a new port allocation after contention");
    const response = await fetch(runtime.origin + "/login", {
      headers: { "x-searchanvil-window": runtime.capability },
      signal: AbortSignal.timeout(5000),
    });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Open local workspace/);
    console.log("Interface port contention reproduced and retried with a new allocation.");
  } finally {
    net.createServer = createServer;
    await runtime?.stop();
    await new Promise((resolve) => blocker.close(resolve));
    console.log("Disposable contention profile " + data);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
