const { fork } = require("node:child_process");
const path = require("node:path");

function launchSupervisor({ resources, data, packaged }, onFailure) {
  const supervisorPath = path.join(__dirname, "supervisor.cjs");
  const child = fork(
    packaged ? supervisorPath.replace(/app\.asar(?=\/)/, "app.asar.unpacked") : supervisorPath,
    [],
    {
      execPath: path.join(resources, "node", "bin", "node"),
      env: { HOME: process.env.HOME, PATH: "/usr/bin:/bin" },
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    },
  );
  let stopping = false;
  let ready = false;
  const exited = new Promise((resolve) => {
    child.once("exit", resolve);
    child.once("error", resolve);
  });

  const stop = async () => {
    stopping = true;
    if (child.connected) child.send({ type: "stop" }, () => {});
    await exited;
  };

  return new Promise((resolve, reject) => {
    function fail(error) {
      if (stopping) return;
      if (ready) onFailure(error);
      else reject(error);
    }
    child.on("message", (message) => {
      if (message.type === "failure") {
        fail(new Error(message.message));
      } else if (message.type === "ready" && !ready) {
        ready = true;
        resolve({ origin: message.origin, capability: message.capability, stop });
      }
    });
    child.once("error", fail);
    child.once("exit", (code, signal) =>
      fail(new Error(`Runtime supervisor exited (${signal ?? code})`)),
    );
    child.send({ resources, data }, (error) => {
      if (error) fail(error);
    });
  });
}

module.exports = { launchSupervisor };
