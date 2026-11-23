const assert = require("node:assert/strict");
const { execFileSync, fork } = require("node:child_process");
const { once } = require("node:events");
const fs = require("node:fs/promises");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { randomBytes } = require("node:crypto");
const { setTimeout: delay } = require("node:timers/promises");
const { launchSupervisor } = require("../supervisor-client.cjs");

async function until(check, label, timeout = 20_000) {
  const deadline = Date.now() + timeout;
  do {
    const result = await check();
    if (result) return result;
    await delay(40);
  } while (Date.now() < deadline);
  throw new Error("Timed out waiting for " + label);
}

function processList() {
  return execFileSync("/bin/ps", ["-axo", "pid=,ppid=,stat=,command="], { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, parent, state, command]) => ({
      pid: Number(pid),
      parent: Number(parent),
      state,
      command,
    }));
}

function tree(list, parent) {
  return list
    .filter((item) => item.parent === parent)
    .flatMap((item) => [item, ...tree(list, item.pid)]);
}

async function host() {
  const instance = await launchSupervisor(
    { resources: process.argv[3], data: process.argv[4] },
    (error) => process.send({ error: error.message }),
  );
  process.send({ origin: instance.origin, capability: instance.capability });
  process.on("message", async () => {
    await instance.stop();
    process.disconnect();
  });
}

async function main() {
  const staged = path.resolve(process.argv[2] ?? path.join(__dirname, "../build/runtime"));
  const work = await fs.mkdtemp(path.join(os.tmpdir(), "anvil-live-"));
  const data = path.join(work, "data");
  const resources = path.join(work, "resources");
  const control = path.join(work, "checkpoint");
  const marker = path.join(work, "reached");
  await fs.mkdir(resources);
  let gate = "";
  const fixture = http.createServer((req, res) => {
    if (
      (gate === "discovery" && req.url === "/robots.txt") ||
      (gate === "sitemap" && req.url === "/sitemap.xml") ||
      (gate === "http-crawl" && req.url === "/")
    ) {
      void fs.writeFile(marker, gate, { mode: 0o600 });
      return;
    }
    if (req.url === "/robots.txt") {
      res.setHeader("content-type", "text/plain");
      res.end(`User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`);
      return;
    }
    if (req.url === "/sitemap.xml") {
      res.setHeader("content-type", "application/xml");
      res.end(
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url></urlset>`,
      );
      return;
    }
    if (req.url === "/" || req.url === "/child") {
      res.setHeader("content-type", "text/html");
      res.end(
        req.url === "/"
          ? '<html><body><a href="/child">Child</a></body></html>'
          : "<html><body>Child fixture</body></html>",
      );
      return;
    }
    res.writeHead(404).end();
  });
  fixture.listen(0, "127.0.0.1");
  await once(fixture, "listening");
  const origin = `http://127.0.0.1:${fixture.address().port}`;
  for (const component of ["api", "web", "database", "native", "node", "chromium"]) {
    await fs.symlink(path.join(staged, component), path.join(resources, component), "dir");
  }
  const worker = path.join(staged, "worker");
  const workerEntry = path.join(worker, "dist", "main.js");
  await fs.mkdir(path.join(resources, "worker", "dist"), { recursive: true });
  const wrapper = path.join(__dirname, "live-recovery-worker.cjs");
  await fs.writeFile(
    path.join(resources, "worker", "dist", "main.js"),
    `require(${JSON.stringify(wrapper)}).run(${JSON.stringify({ workerEntry, control, marker, origin })});\n`,
  );
  const { PrismaClient } = require(require.resolve("@searchanvil/database", { paths: [worker] }));

  let current;
  let owned = [];
  let prisma;
  let databaseSocket;
  let session = [];
  let csrf = "";
  const creds = { email: "recovery@example.test", password: randomBytes(24).toString("hex") };
  async function start() {
    const child = fork(__filename, ["--host", resources, data], {
      stdio: ["ignore", "ignore", "inherit", "ipc"],
    });
    const ready = await Promise.race([
      once(child, "message").then(([message]) => message),
      once(child, "exit").then(([code]) => {
        throw new Error(`Runtime host exited ${code}`);
      }),
      delay(30_000, null, { ref: false }),
    ]);
    assert.ok(ready?.origin, ready?.error ?? "Runtime host startup timed out");
    current = { child, ...ready };
    const postgres = tree(processList(), child.pid).find(({ command }) =>
      command.includes("postgres -D "),
    );
    const socket = postgres?.command.match(/ -k (.+?) -c /)?.[1];
    assert.ok(socket, "Expected owned PostgreSQL socket");
    databaseSocket = socket;
    prisma = new PrismaClient({
      datasourceUrl: `postgresql://searchanvil@localhost:5432/postgres?host=${encodeURIComponent(socket)}`,
    });
  }

  async function api(method, endpoint, body, expected) {
    const response = await fetch(current.origin + "/desktop-api/api/v1" + endpoint, {
      method,
      headers: {
        "x-searchanvil-window": current.capability,
        cookie: session.join("; "),
        "x-csrf-token": csrf,
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(5000),
    });
    const result = await response.json().catch(() => undefined);
    assert.equal(response.status, expected, `${method} ${endpoint} ${JSON.stringify(result)}`);
    if (response.headers.getSetCookie().length) {
      session = response.headers.getSetCookie().map((cookie) => cookie.split(";")[0]);
      csrf = session.find((cookie) => cookie.startsWith("searchanvil_csrf="))?.split("=")[1] ?? "";
    }
    return result;
  }

  function servicePorts(processes) {
    const pids = processes.map(({ pid }) => pid).join(",");
    try {
      return [
        ...new Set(
          execFileSync(
            "/usr/sbin/lsof",
            ["-a", "-p", pids, "-iTCP", "-sTCP:LISTEN", "-Fn", "-nP"],
            { encoding: "utf8" },
          )
            .split("\n")
            .flatMap((row) => /127\.0\.0\.1:(\d+)$/.exec(row)?.slice(1) ?? []),
        ),
      ].map(Number);
    } catch (error) {
      if (error.status !== 1) throw error;
      return [];
    }
  }

  function portOpen(port) {
    return new Promise((resolve) => {
      const socket = net.connect({ host: "127.0.0.1", port });
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
      socket.setTimeout(250, () => {
        socket.destroy();
        resolve(false);
      });
    });
  }

  async function interrupt() {
    const { child, origin: gateway } = current;
    await prisma.$disconnect();
    prisma = undefined;
    owned = tree(processList(), child.pid);
    assert.ok(owned.some(({ command }) => command.includes("supervisor.cjs")));
    const ports = servicePorts(owned);
    assert.ok(ports.includes(Number(new URL(gateway).port)));
    if (gate === "performance")
      assert.ok(
        owned.some(({ command }) => command.includes("Chrome for Testing")),
        "Expected a real Chromium process",
      );
    const stopped = once(child, "exit");
    child.kill("SIGKILL");
    current = undefined;
    await stopped;
    await until(
      () => {
        const now = processList();
        return owned.every(
          (old) =>
            !now.some(
              (p) => p.pid === old.pid && p.command === old.command && !p.state.startsWith("Z"),
            ),
        );
      },
      "owned supervisor and service exit",
      18_000,
    );
    assert.ok(
      (await Promise.all(ports.map(portOpen))).every((open) => !open),
      "Old listener survived shutdown",
    );
    owned = [];
    gate = "";
    await fs.rm(control, { force: true });
    await fs.rm(marker, { force: true });
    return ports.length;
  }

  try {
    await start();
    await api(
      "POST",
      "/auth/register",
      { ...creds, name: "Recovery QA", organizationName: "Disposable" },
      201,
    );
    const [org] = await api("GET", "/organizations", undefined, 200);
    const parent = `/organizations/${org.id}/projects`;
    const project = await api("POST", parent, { name: "Recovery QA" }, 201);
    const site = await api(
      "POST",
      `${parent}/${project.id}/sites`,
      { rootUrl: origin, displayName: "Fixture" },
      201,
    );
    const endpoint = `${parent}/${project.id}/sites/${site.id}/crawls`;
    const create = () => api("POST", endpoint, { maxPages: 2 }, 201);
    const state = (id) =>
      prisma.crawl.findUniqueOrThrow({
        where: { id },
        include: {
          auditRun: { include: { score: true, issues: true } },
          pages: { include: { performance: true } },
        },
      });
    const complete = async (id) =>
      until(
        async () => {
          const result = await state(id);
          return (
            result.auditRun?.status === "COMPLETED" &&
            result.pages.length === 2 &&
            result.pages.every((page) => page.performance?.status === "COMPLETED") &&
            result
          );
        },
        "completed audit and two real Chromium measurements",
        30_000,
      );

    const baseline = await complete((await create()).id);
    assert.ok(baseline.auditRun.score);
    const cancelled = await create();
    await api("PATCH", endpoint + "/" + cancelled.id + "/cancel", undefined, 200);
    assert.equal((await state(cancelled.id)).status, "CANCELLED");
    const checkpoints = [
      "queued",
      "discovery",
      "sitemap",
      "http-crawl",
      "page-persistence",
      "link-resolution",
      "audit-engine",
      "audit-persistence",
      "performance",
      "completion",
      "crawl-completion",
    ];
    const only = process.env.SEARCHANVIL_LIVE_CHECKPOINT;
    if (only) assert.ok(checkpoints.includes(only), "Unknown checkpoint");
    for (const checkpoint of only ? [only] : checkpoints) {
      gate = checkpoint;
      await fs.writeFile(control, gate, { mode: 0o600 });
      if (checkpoint === "queued") {
        const process = tree(processList(), current.child.pid).find(({ command }) =>
          command.endsWith("/worker/dist/main.js"),
        );
        assert.ok(process, "Expected owned worker to pause");
        global.process.kill(process.pid, "SIGSTOP");
      }
      const interrupted = await create();
      if (checkpoint === "queued") {
        assert.equal((await state(interrupted.id)).status, "PENDING");
      } else {
        await until(
          () =>
            fs.readFile(marker, "utf8").then(
              (value) => value === checkpoint,
              () => false,
            ),
          checkpoint,
        );
      }
      if (["audit-persistence", "completion"].includes(checkpoint)) {
        const visible = await state(interrupted.id);
        assert.equal(visible.auditRun.status, "RUNNING");
        assert.equal(visible.auditRun.score, null, "An in-flight audit must have no visible score");
        assert.equal(
          visible.auditRun.issues.length,
          0,
          "An in-flight audit must have no visible findings",
        );
      }
      const ports = await interrupt();
      await start();
      const saved = await state(baseline.id);
      assert.deepEqual(saved.auditRun.score, baseline.auditRun.score);
      const byId = (left, right) => left.id.localeCompare(right.id);
      assert.deepEqual(saved.auditRun.issues.sort(byId), baseline.auditRun.issues.sort(byId));
      assert.equal((await state(cancelled.id)).status, "CANCELLED");
      if (checkpoint === "queued") {
        const queued = await complete(interrupted.id);
        assert.equal(queued.pagesCrawled, 2);
      } else if (checkpoint === "performance") {
        const recovered = await state(interrupted.id);
        assert.ok(recovered.pages.some((page) => page.performance?.status === "FAILED"));
        const config = await fs.readFile(path.join(databaseSocket, "redis.conf"), "utf8");
        const port = Number(/^port (\d+)$/m.exec(config)?.[1]);
        const password = /^requirepass (\w+)$/m.exec(config)?.[1];
        assert.ok(port && password);
        const queuePath = require.resolve("@searchanvil/queue", { paths: [worker] });
        const { Queue } = require(require.resolve("bullmq", { paths: [queuePath] }));
        const queue = new Queue("performance", {
          connection: { host: "127.0.0.1", port, password },
        });
        try {
          const replay = await queue.add(
            "performance",
            { crawlId: interrupted.id },
            {
              jobId: `qa-replay-${interrupted.id}`,
            },
          );
          await until(
            async () => (await replay.getState()) === "completed",
            "replayed performance job",
          );
          const after = await state(interrupted.id);
          assert.deepEqual(
            after.pages
              .map(({ performance }) => performance)
              .sort((a, b) => (a?.pageId ?? "").localeCompare(b?.pageId ?? "")),
            recovered.pages
              .map(({ performance }) => performance)
              .sort((a, b) => (a?.pageId ?? "").localeCompare(b?.pageId ?? "")),
          );
        } finally {
          await queue.close();
        }
      } else if (checkpoint === "crawl-completion") {
        const recovered = await state(interrupted.id);
        assert.equal(recovered.status, "COMPLETED");
        assert.equal(recovered.auditRun.status, "FAILED");
        assert.equal(recovered.auditRun.score, null);
      } else if (["audit-engine", "audit-persistence", "completion"].includes(checkpoint)) {
        const recovered = await state(interrupted.id);
        assert.equal(recovered.auditRun.status, "FAILED");
        assert.equal(recovered.auditRun.score, null);
        assert.equal(recovered.auditRun.issues.length, 0);
      } else {
        const recovered = await state(interrupted.id);
        assert.equal(recovered.status, "FAILED");
        assert.equal(recovered.auditRun, null);
      }
      await complete((await create()).id);
      const log = await fs.readFile(path.join(data, "logs", "Worker.log"), "utf8");
      const claims = log
        .split("\n")
        .filter(
          (line) =>
            line.includes('"message":"processing crawl job"') && line.includes(interrupted.id),
        );
      assert.equal(claims.length, 1, "The interrupted crawl was claimed more than once");
      console.log(JSON.stringify({ checkpoint, status: "passed", oldListenersClosed: ports }));
    }
  } finally {
    await prisma?.$disconnect();
    if (current) {
      const exited = once(current.child, "exit");
      current.child.send("stop");
      await exited;
    }
    for (const process of processList()) {
      if (
        owned.some(
          (p) =>
            p.pid === process.pid &&
            p.command === process.command &&
            !process.state.startsWith("Z"),
        )
      ) {
        try {
          global.process.kill(process.pid, "SIGKILL");
        } catch (e) {
          if (e.code !== "ESRCH") throw e;
        }
      }
    }
    fixture.closeAllConnections();
    await new Promise((resolve) => fixture.close(resolve));
    console.log("Disposable evidence directory " + work);
  }
}

(process.argv[2] === "--host" ? host() : main()).catch((error) => {
  if (process.send) process.send({ error: error.message });
  console.error(error);
  process.exitCode = 1;
});
