const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { setTimeout: delay } = require("node:timers/promises");
const { randomBytes } = require("node:crypto");
const { mkdtemp, readdir, readFile, writeFile } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { startRuntime } = require("../runtime.cjs");

async function main() {
  const resources = path.resolve(process.argv[2] ?? path.join(__dirname, "../build/runtime"));
  const data = await mkdtemp(path.join(os.tmpdir(), "searchanvil-smoke-"));
  const errors = [];
  console.log(`Test data: ${data}`);

  const cookies = new Map();
  const credentials = {
    email: "desktop-smoke@example.test",
    password: randomBytes(24).toString("hex"),
  };
  async function useRuntime(work, expectedErrors = []) {
    const runtime = await startRuntime(resources, data, (error) => errors.push(error.message));
    try {
      const api = async (endpoint, body, expected = 200, method = body ? "POST" : "GET") => {
        const headers = {
          "x-searchanvil-window": runtime.capability,
          cookie: Array.from(cookies, ([name, value]) => `${name}=${value}`).join("; "),
          "x-csrf-token": cookies.get("searchanvil_csrf") ?? "",
        };
        if (body) {
          headers["content-type"] = "application/json";
          headers.origin = runtime.origin;
        }
        const response = await fetch(runtime.origin + "/desktop-api/api/v1" + endpoint, {
          headers,
          method,
          body: body && JSON.stringify(body),
        });
        assert.equal(response.status, expected, `${endpoint}: HTTP ${response.status}`);
        for (const cookie of response.headers.getSetCookie()) {
          const [pair] = cookie.split(";");
          const separator = pair.indexOf("=");
          cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
        }
        return response.json();
      };
      await work(runtime, api);
    } finally {
      await runtime.stop();
    }
    assert.deepEqual(errors.splice(0), expectedErrors);
    await assert.rejects(fetch(runtime.origin, { signal: AbortSignal.timeout(1000) }));
  }

  function workerProcess() {
    const workerPath = path.join(resources, "worker", "dist", "main.js");
    const children = execFileSync("/bin/ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" });
    const workerPid = children
      .split("\n")
      .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(.*)$/))
      .find((row) => row && Number(row[2]) === process.pid && row[3].endsWith(workerPath))?.[1];
    assert.ok(workerPid, "Only the worker child of this smoke test can be terminated.");
    return Number(workerPid);
  }

  let organizationId;
  let projectId;
  let siteId;
  await useRuntime(async (runtime, api) => {
    assert.equal((await fetch(runtime.origin)).status, 403);
    const page = await fetch(runtime.origin + "/login", {
      headers: { "x-searchanvil-window": runtime.capability },
    });
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Open local workspace/);

    await api(
      "/auth/register",
      {
        ...credentials,
        name: "Desktop tester",
        organizationName: "Smoke workspace",
      },
      201,
    );
    [{ id: organizationId }] = await api("/organizations");
    ({ id: projectId } = await api(
      `/organizations/${organizationId}/projects`,
      {
        name: "Smoke project",
      },
      201,
    ));
    ({ id: siteId } = await api(
      `/organizations/${organizationId}/projects/${projectId}/sites`,
      {
        rootUrl: "https://example.com",
        displayName: "Example",
      },
      201,
    ));
    console.log("Initialized local data and created workspace, project and website.");
  });

  cookies.clear();
  await useRuntime(async (_runtime, api) => {
    await api("/auth/login", credentials);
    const project = await api(`/organizations/${organizationId}/projects/${projectId}`);
    assert.equal(project.name, "Smoke project");
    console.log("Restart retained the user, organization and project.");
  });

  cookies.clear();
  await useRuntime(async (_runtime, api) => {
    await api("/auth/login", { ...credentials, password: randomBytes(24).toString("hex") }, 401);
    await api("/auth/login", credentials);
    const crawls = `/organizations/${organizationId}/projects/${projectId}/sites/${siteId}/crawls`;
    const pid = workerProcess();
    process.kill(pid, "SIGSTOP");
    try {
      const crawl = await api(crawls, { maxPages: 1 }, 201);
      const cancelled = await api(crawls + "/" + crawl.id + "/cancel", undefined, 200, "PATCH");
      assert.equal(cancelled.status, "CANCELLED");
    } finally {
      process.kill(pid, "SIGCONT");
    }
  });
  console.log("Rejected an invalid password and cancelled a queued crawl.");

  // Simulate an older migration revision without altering the PostgreSQL schema.
  await writeFile(path.join(data, "migration-revision"), "test-previous-revision");
  await useRuntime(async () => {
    const backups = await readdir(path.join(data, "backups"));
    assert.equal(backups.length, 1);
    const dump = path.join(data, "backups", backups[0], "postgres.dump");
    const archive = execFileSync(
      path.join(resources, "native", "bin", "pg_restore"),
      ["--list", dump],
      { encoding: "utf8" },
    );
    assert.match(archive, /TABLE DATA public projects/);

    process.kill(workerProcess(), "SIGKILL");
    for (let attempt = 0; attempt < 50 && !errors.length; attempt += 1) await delay(50);
  }, ["Worker exited (SIGKILL)"]);
  await useRuntime(async (_runtime, api) => {
    await api("/auth/login", credentials);
    const project = await api(`/organizations/${organizationId}/projects/${projectId}`);
    assert.equal(project.name, "Smoke project");
  });
  console.log(
    "Verified pre-migration backup, worker crash detection, service cleanup and restart.",
  );

  const browserName = (
    await readFile(path.join(resources, "chromium", "executable"), "utf8")
  ).trim();
  const worker = path.join(resources, "worker");
  const { chromium } = require(
    require.resolve("playwright-core", {
      paths: [path.dirname(require.resolve("@searchanvil/performance", { paths: [worker] }))],
    }),
  );
  const browser = await chromium.launch({
    executablePath: path.join(
      resources,
      "chromium",
      "Chromium.app",
      "Contents",
      "MacOS",
      browserName,
    ),
  });
  try {
    const page = await browser.newPage();
    await page.setContent("<title>SearchAnvil browser fixture</title>");
    assert.equal(await page.title(), "SearchAnvil browser fixture");
    console.log("Launched bundled Chromium and rendered an offline fixture.");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
