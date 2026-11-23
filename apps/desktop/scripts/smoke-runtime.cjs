const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtemp, readFile } = require("node:fs/promises");
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
  async function useRuntime(work) {
    const runtime = await startRuntime(resources, data, (error) => errors.push(error.message));
    try {
      const api = async (endpoint, body, expected = 200) => {
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
          method: body ? "POST" : "GET",
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
    assert.deepEqual(errors, []);
    await assert.rejects(fetch(runtime.origin, { signal: AbortSignal.timeout(1000) }));
  }

  let organizationId;
  let projectId;
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
    await api(
      `/organizations/${organizationId}/projects/${projectId}/sites`,
      {
        rootUrl: "https://example.com",
        displayName: "Example",
      },
      201,
    );
    console.log("Initialized local data and created workspace, project and website.");
  });

  cookies.clear();
  await useRuntime(async (_runtime, api) => {
    await api("/auth/login", credentials);
    const project = await api(`/organizations/${organizationId}/projects/${projectId}`);
    assert.equal(project.name, "Smoke project");
    console.log("Restart retained the user, organization and project.");
  });

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
