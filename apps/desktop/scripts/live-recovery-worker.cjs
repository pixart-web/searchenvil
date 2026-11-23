// Test-only worker entry used in a temporary staging tree. It is not part of
// the packaged application. All network fixtures are bound to loopback.
const { createRequire } = require("node:module");
const { readFileSync, writeFileSync } = require("node:fs");
const http = require("node:http");
const path = require("node:path");

function run({ workerEntry, control, marker, origin }) {
  const resolveWorker = createRequire(workerEntry);
  function stage() {
    try {
      return readFileSync(control, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      return "";
    }
  }

  function mark(name) {
    writeFileSync(marker, name, { mode: 0o600 });
  }

  const crawlerIndex = resolveWorker.resolve("@searchanvil/crawler");
  const { Agent } = createRequire(crawlerIndex)("undici");
  const crawler = require(path.join(path.dirname(crawlerIndex), "crawler.js"));
  const realCrawl = crawler.runCrawl;
  crawler.runCrawl = async (config, options) => {
    if (new URL(config.startUrl).origin !== origin) throw new Error("Unexpected fixture origin.");
    const dispatcher = new Agent();
    try {
      return await realCrawl(config, { ...options, dispatcher });
    } finally {
      await dispatcher.destroy();
    }
  };

  const database = resolveWorker("@searchanvil/database");
  const original = database.prisma;
  database.prisma = original.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const result = await query(args);
          const stageName =
            model === "CrawlPage" && operation === "upsert"
              ? "page-persistence"
              : model === "CrawlLink" && operation === "createMany"
                ? "link-resolution"
                : model === "Crawl" &&
                    operation === "updateMany" &&
                    args.data.status === "COMPLETED"
                  ? "crawl-completion"
                  : model === "AuditScore" && operation === "upsert"
                    ? "audit-persistence"
                    : model === "AuditRun" &&
                        operation === "updateMany" &&
                        args.data.status === "COMPLETED"
                      ? "completion"
                      : undefined;
          if (stageName && stage() === stageName) {
            mark(stageName);
            await new Promise(() => {});
          }
          return result;
        },
      },
    },
  });

  const { ALL_RULES } = resolveWorker("@searchanvil/audit-engine");
  const rule = ALL_RULES[0];
  const evaluate = rule.evaluate;
  rule.evaluate = (site) => {
    const findings = evaluate(site);
    if (stage() === "audit-engine") {
      mark("audit-engine");
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 60_000);
    }
    return findings;
  };

  // Chromium remains real. Only this test's fixed loopback fixture is routed
  // through the replacement proxy. Production egress checks stay unchanged.
  const performance = resolveWorker.resolve("@searchanvil/performance");
  const network = require(path.join(path.dirname(performance), "browser-network.js"));
  network.createBrowserNetwork = () =>
    new Promise((resolve, reject) => {
      const server = http.createServer((req, res) => {
        let target;
        try {
          target = new URL(req.url);
        } catch {
          res.writeHead(403).end();
          return;
        }
        if (target.origin !== origin) {
          res.writeHead(403).end();
          return;
        }
        if (stage() === "performance" && target.pathname === "/") {
          mark("performance");
          return;
        }
        res
          .writeHead(200, { "content-type": "text/html" })
          .end("<html><title>Browser fixture</title><body>Measured</body></html>");
      });
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () =>
        resolve({
          server: `http://127.0.0.1:${server.address().port}`,
          close: () =>
            new Promise((done) => {
              server.close(done);
              server.closeAllConnections();
            }),
        }),
      );
    });

  require(workerEntry);
}

module.exports = { run };
