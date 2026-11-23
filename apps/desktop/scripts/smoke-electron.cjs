const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const { mkdtemp, readFile, realpath } = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

const performancePackage = path.resolve(__dirname, "../../../packages/performance");
const { _electron } = require(require.resolve("playwright-core", { paths: [performancePackage] }));

async function main() {
  assert.ok(process.argv[2], "Pass the packaged SearchAnvil executable as the first argument.");
  const executablePath = path.resolve(process.argv[2]);
  const data = await mkdtemp(path.join(os.tmpdir(), "searchanvil-electron-smoke-"));
  const email = "desktop-smoke@example.test";
  const password = randomBytes(24).toString("hex");

  const previous = process.env.SEARCHANVIL_SMOKE_PREVIOUS_EXECUTABLE;

  async function run(work, launchPath = executablePath) {
    const electron = await _electron.launch({
      executablePath: launchPath,
      args: [`--user-data-dir=${data}`],
      timeout: 60_000,
    });
    try {
      const usedData = await electron.evaluate(({ app }) => app.getPath("userData"));
      assert.equal(await realpath(usedData), await realpath(data));
      const page = await electron.firstWindow({ timeout: 60_000 });
      await work(page, electron);
    } finally {
      await electron.close();
    }
  }

  const seedWorkspace = async (page, electron) => {
    await page.getByRole("heading", { name: "Open local workspace" }).waitFor();
    assert.deepEqual(
      await page.evaluate(() => ({
        node: typeof window.require,
        ipc: typeof window.searchAnvilDesktop?.status,
      })),
      { node: "undefined", ipc: "function" },
    );
    assert.equal((await page.evaluate(() => window.searchAnvilDesktop.status())).runtime, "ready");
    const preferences = await electron.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
    );
    assert.equal(preferences.contextIsolation, true);
    assert.equal(preferences.sandbox, true);
    assert.equal(preferences.nodeIntegration, false);
    assert.equal(await page.evaluate(() => Boolean(window.open("https://example.com"))), false);
    await page.getByRole("link", { name: "Create local workspace" }).click();
    await page.getByLabel("Your name").fill("Desktop Tester");
    await page.getByLabel("Workspace name").fill("Smoke Workspace");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Create workspace" }).click();
    await page.getByLabel("Website URL").fill("https://example.com");
    await page.getByRole("button", { name: "Forge my first audit" }).click();
    await page.getByRole("button", { name: "View project" }).click();
    await page
      .getByRole("navigation", { name: "Project" })
      .getByRole("link", { name: "Audits" })
      .click();
    await page.getByRole("heading", { name: "Audits" }).waitFor();
    const runCrawl = page.getByRole("button", { name: "Run crawl" });
    await runCrawl.waitFor();
    if (process.env.SEARCHANVIL_SMOKE_LIVE === "1") {
      const projectId = /\/app\/projects\/([^/]+)/.exec(page.url())?.[1];
      assert.ok(projectId);
      const base = await page.evaluate(async (id) => {
        const prefix = "/desktop-api/api/v1";
        const [org] = await (await fetch(prefix + "/organizations")).json();
        const base = prefix + "/organizations/" + org.id + "/projects/" + id;
        return base;
      }, projectId);
      const waitForScore = (count) =>
        page.waitForFunction(
          async ({ base, count }) => {
            const overview = await (await fetch(base + "/overview")).json();
            return (
              overview.sites[0].recentCrawls.filter(
                (crawl) => crawl.status === "COMPLETED" && crawl.overallScore !== null,
              ).length >= count
            );
          },
          { base, count },
          { timeout: 60_000, polling: 1000 },
        );

      await waitForScore(1);
      await runCrawl.click();
      await waitForScore(2);
      const nav = page.getByRole("navigation", { name: "Project" });
      await page.getByRole("link", { name: "Compare to previous" }).first().click();
      await page.getByRole("heading", { name: "Crawl Comparison" }).waitFor();
      await nav.getByRole("link", { name: "Issues" }).click();
      await page.locator('main a[href*="/issues/"]').first().click();
      await nav.getByRole("link", { name: "Pages" }).click();
      await page.locator('main a[href*="/pages/"]').first().click();

      const progress = await page.waitForFunction(
        async (base) => {
          const url = base + "/performance";
          const response = await fetch(url);
          if (!response.ok) return false;
          const result = await response.json();
          return result.samples?.some((sample) => sample.status === "COMPLETED");
        },
        base,
        { timeout: 60_000, polling: 1000 },
      );
      assert.equal(await progress.jsonValue(), true);
      await nav.getByRole("link", { name: "Performance" }).click();
      await page
        .getByText(/TTFB \d+ms/)
        .first()
        .waitFor();

      await nav.getByRole("link", { name: "Reports" }).click();
      await page.locator('main a[href*="/reports/"]').first().click();
      const csv = await page.getByRole("link", { name: "Download CSV" }).getAttribute("href");
      const report = await page.evaluate(async (url) => {
        const response = await fetch(url);
        return {
          status: response.status,
          type: response.headers.get("content-type"),
          text: await response.text(),
        };
      }, csv);
      assert.equal(report.status, 200);
      assert.match(report.type, /^text\/csv/);
      assert.match(report.text, /Rule Key,Category,Severity/);
      const exportPath = path.join(data, "smoke-export.csv");
      await electron.evaluate(({ BrowserWindow }, destination) => {
        BrowserWindow.getAllWindows()[0].webContents.session.once(
          "will-download",
          (_event, item) => {
            item.setSavePath(destination);
          },
        );
      }, exportPath);
      await page.getByRole("link", { name: "Download CSV" }).click();
      for (let attempt = 0; attempt < 30; attempt += 1) {
        if ((await readFile(exportPath, "utf8").catch(() => undefined)) === report.text) break;
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
      assert.equal(await readFile(exportPath, "utf8"), report.text);
      if (process.env.SEARCHANVIL_SMOKE_SCREENSHOT) {
        await nav.getByRole("link", { name: "Overview" }).click();
        await page.getByRole("heading", { name: "Technical health matrix" }).waitFor();
        await page.getByRole("heading", { name: "Forge Priorities" }).waitFor();
        assert.ok(await page.locator(".operations-category").count());
        const metrics = await page.locator(".operations-metrics dd").allTextContents();
        assert.equal(
          metrics.slice(2, -1).reduce((total, count) => total + Number(count), 0),
          Number(metrics.at(-1)),
        );
        await page.screenshot({ path: process.env.SEARCHANVIL_SMOKE_SCREENSHOT });
        await page.setViewportSize({ width: 820, height: 600 });
        assert.equal(
          await page.evaluate(() => {
            const workspace = document.querySelector(".command-workspace");
            return workspace && workspace.scrollWidth <= workspace.clientWidth;
          }),
          true,
        );
        console.log("Verified the diagnostic overview and no horizontal overflow at 820 × 600.");
      }
      console.log(
        "Completed two audits and verified issue and page detail, comparison, performance and CSV.",
      );
    }
    console.log(
      "Opened the app, verified renderer isolation, registered, created a project and opened Audits.",
    );
  };
  await run(seedWorkspace, previous ? path.resolve(previous) : executablePath);

  await run(async (page) => {
    const project = page.getByRole("link", { name: /example/i });
    const signIn = page.getByRole("heading", { name: "Open local workspace" });
    await project.or(signIn).waitFor();
    if (await signIn.isVisible()) {
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
    }
    await project.waitFor();
    console.log(
      previous
        ? "Opened the previous build’s project in the patched build."
        : "Relaunched the app and found the persisted project.",
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
