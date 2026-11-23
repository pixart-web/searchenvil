const assert = require("node:assert/strict");
const { execFileSync, spawn } = require("node:child_process");
const { mkdtemp, readFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { setTimeout: delay } = require("node:timers/promises");

const { _electron } = require(
  require.resolve("playwright-core", {
    paths: [path.resolve(__dirname, "../../../packages/performance")],
  }),
);

function processes() {
  return execFileSync("/bin/ps", ["-axo", "pid=,ppid=,stat=,%cpu=,rss=,command="], {
    encoding: "utf8",
  })
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s+([\d.]+)\s+(\d+)\s+(.*)$/))
    .filter(Boolean)
    .map(([, pid, parent, state, cpu, rss, command]) => ({
      pid: Number(pid),
      parent: Number(parent),
      state,
      cpu: Number(cpu),
      rss: Number(rss),
      command,
    }));
}

function descendants(list, pid) {
  const children = list.filter((item) => item.parent === pid);
  return children.flatMap((child) => [child, ...descendants(list, child.pid)]);
}

async function main() {
  const executablePath = path.resolve(process.argv[2]);
  const data = await mkdtemp(path.join(os.tmpdir(), "anvil-force-qa-"));
  const args = [`--user-data-dir=${data}`];
  const began = performance.now();
  let app = await _electron.launch({ executablePath, args, timeout: 45_000 });
  let services = [];
  try {
    const page = await app.firstWindow({ timeout: 45_000 });
    await page.getByRole("heading", { name: "Open local workspace" }).waitFor();
    const startupMs = Math.round(performance.now() - began);
    const origin = new URL(page.url()).origin;
    const parent = app.process().pid;
    const second = spawn(executablePath, args, { stdio: "ignore" });
    const secondExit = new Promise((resolve, reject) => {
      second.once("exit", resolve);
      second.once("error", reject);
    });
    try {
      const result = await Promise.race([secondExit, delay(8000, "timeout", { ref: false })]);
      assert.equal(result, 0, "A second instance with the same profile should exit.");
      assert.equal(
        await page.getByRole("heading", { name: "Open local workspace" }).isVisible(),
        true,
      );
    } finally {
      if (second.exitCode === null && second.signalCode === null) second.kill("SIGKILL");
    }
    console.log("Second-instance lock passed.");
    await delay(1000);
    const snapshot = processes();
    const tree = descendants(snapshot, parent);
    const sample = [...tree, ...snapshot.filter(({ pid }) => pid === parent)];
    console.log(
      "Resource sample",
      JSON.stringify({
        startupMs,
        idleCpuPercent: sample.reduce((sum, { cpu }) => sum + cpu, 0),
        idleRssMiB: Math.round(sample.reduce((sum, { rss }) => sum + rss, 0) / 1024),
        processes: sample.length,
      }),
    );
    const supervisor = tree.find(({ command }) => command.endsWith("/supervisor.cjs"));
    assert.ok(supervisor, "Expected the owned runtime supervisor");
    services = [supervisor, ...descendants(snapshot, supervisor.pid)];
    assert.ok(services.length >= 5, "Expected owned local runtime services");
    const postgres = services.find(
      ({ command }) => command.includes(" -D ") && command.includes("postgres"),
    );
    const socket = postgres?.command.match(/ -k (.+?) -c /)?.[1];
    assert.ok(socket);
    const runtime = path.resolve(path.dirname(executablePath), "../Resources/runtime");
    const database = require(
      require.resolve("@searchanvil/database", { paths: [path.join(runtime, "worker")] }),
    );
    const prisma = new database.PrismaClient({
      datasourceUrl: `postgresql://searchanvil@localhost:5432/postgres?host=${encodeURIComponent(socket)}`,
    });
    let crawl;
    let complete;
    try {
      const organization = await prisma.organization.create({
        data: { name: "Crash fixture", slug: "crash-fixture" },
      });
      const project = await prisma.project.create({
        data: { organizationId: organization.id, name: "Crash fixture" },
      });
      const site = await prisma.site.create({
        data: { projectId: project.id, rootUrl: "https://example.test", displayName: "Fixture" },
      });
      crawl = await prisma.crawl.create({
        data: { siteId: site.id, status: "CRAWLING", config: {} },
      });
      complete = await prisma.crawl.create({
        data: {
          siteId: site.id,
          status: "COMPLETED",
          config: {},
          auditRun: { create: { status: "COMPLETED", rulesetVersion: "fixture" } },
        },
      });
    } finally {
      await prisma.$disconnect();
    }

    const killedAt = performance.now();
    app.process().kill("SIGKILL");
    app = undefined;
    const survivors = () =>
      processes().filter(
        (current) =>
          !current.state.startsWith("Z") &&
          services.some(({ pid, command }) => pid === current.pid && current.command === command),
      );
    for (let n = 0; n < 120 && survivors().length; n += 1) await delay(100);
    assert.deepEqual(
      survivors().map(({ pid }) => pid),
      [],
    );
    console.log("Service cleanup milliseconds", Math.round(performance.now() - killedAt));
    await assert.rejects(fetch(origin, { signal: AbortSignal.timeout(1000) }));

    app = await _electron.launch({ executablePath, args, timeout: 45_000 });
    const restarted = await app.firstWindow({ timeout: 45_000 });
    await restarted.getByRole("heading", { name: "Open local workspace" }).waitFor();
    const log = await readFile(path.join(data, "logs", "PostgreSQL.log"), "utf8");
    assert.match(log, /database system is ready to accept connections/);
    const newPg = descendants(processes(), app.process().pid).find(
      ({ command }) => command.includes("runtime/native/bin/postgres") && command.includes(" -k "),
    );
    const newSocket = newPg?.command.match(/ -k (.+?) -c /)?.[1];
    assert.ok(newSocket);
    const recovered = new database.PrismaClient({
      datasourceUrl: `postgresql://searchanvil@localhost:5432/postgres?host=${encodeURIComponent(newSocket)}`,
    });
    try {
      assert.equal(
        (await recovered.crawl.findUniqueOrThrow({ where: { id: crawl.id } })).status,
        "FAILED",
      );
      const completed = await recovered.crawl.findUniqueOrThrow({
        where: { id: complete.id },
        include: { auditRun: true },
      });
      assert.equal(completed.status, "COMPLETED");
      assert.equal(completed.auditRun.status, "COMPLETED");
    } finally {
      await recovered.$disconnect();
    }
    console.log(
      "Electron SIGKILL, owned service cleanup, gateway closure, relaunch and persisted-state reconciliation passed.",
    );
  } finally {
    await app?.close();
    // On regression, clean up only processes observed in this test's original process tree.
    for (const entry of processes()) {
      if (!services.some(({ pid, command }) => pid === entry.pid && command === entry.command))
        continue;
      try {
        process.kill(entry.pid, "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
