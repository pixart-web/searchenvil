const assert = require("node:assert/strict");
const http = require("node:http");
const { test } = require("node:test");
const { gateway } = require("./runtime.cjs");

async function localServer(server, t) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  t.after(
    () =>
      new Promise((resolve) => {
        server.close(resolve);
        server.closeAllConnections();
      }),
  );
  return server.address().port;
}

test("gateway gates renderer traffic and forwards API credentials only to the API", async (t) => {
  const observed = [];
  const upstream = (kind) =>
    http.createServer((req, res) => {
      observed.push({ kind, url: req.url, headers: req.headers });
      res.end(kind);
    });

  const [apiPort, webPort] = await Promise.all([
    localServer(upstream("api"), t),
    localServer(upstream("web"), t),
  ]);
  let origin;
  const capability = "test-capability";
  const proxy = gateway({ capability, apiPort, webPort, getOrigin: () => origin });
  origin = `http://127.0.0.1:${await localServer(proxy, t)}`;
  const headers = { "x-searchanvil-window": capability };

  assert.equal((await fetch(origin)).status, 403);
  assert.equal(
    (await fetch(origin, { headers: { ...headers, origin: "https://example.invalid" } })).status,
    403,
  );
  assert.equal(observed.length, 0);

  const page = await fetch(origin + "/app/projects", { headers });
  assert.equal(await page.text(), "web");
  assert.match(page.headers.get("content-security-policy"), /frame-ancestors 'none'/);

  const api = await fetch(origin + "/desktop-api/api/v1/organizations", { headers });
  assert.equal(await api.text(), "api");
  assert.equal(observed[0].headers["x-searchanvil-window"], undefined);
  assert.equal(observed[0].headers["x-searchanvil-desktop-capability"], undefined);
  assert.equal(observed[1].headers["x-searchanvil-desktop-capability"], capability);
  assert.equal(observed[1].url, "/api/v1/organizations");
});

test("missing runtime binaries fail before an application endpoint is returned", async (t) => {
  const { mkdtemp, rm } = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const { startRuntime } = require("./runtime.cjs");
  const profile = await mkdtemp(path.join(os.tmpdir(), "anvil-qa-missing-"));
  t.after(() => rm(profile, { recursive: true, force: true }));
  await assert.rejects(
    startRuntime(path.join(profile, "missing"), profile, () => {}),
    /database-init failed/,
  );
});

test("a profile path that is not a directory fails closed", async (t) => {
  const { mkdtemp, writeFile, rm } = require("node:fs/promises");
  const os = require("node:os");
  const path = require("node:path");
  const { startRuntime } = require("./runtime.cjs");
  const profile = await mkdtemp(path.join(os.tmpdir(), "anvil-qa-storage-"));
  t.after(() => rm(profile, { recursive: true, force: true }));
  const file = path.join(profile, "profile");
  await writeFile(file, "existing data");
  await assert.rejects(
    startRuntime(profile, file, () => {}),
    { code: "ENOTDIR" },
  );
});
