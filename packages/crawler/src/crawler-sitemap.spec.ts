import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Agent } from "undici";
import { runCrawl } from "./crawler";
import { DEFAULT_CRAWL_CONFIG } from "./types";
import { startFixtureServer, type FixtureServer } from "./fixtures/fixture-server";

const testAgent = new Agent();

function page(title: string, body: string): string {
  return `<html><head><title>${title}</title></head><body>${body}</body></html>`;
}

function urlset(urls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;
}

function sitemapIndex(sitemapUrls: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapUrls.map((u) => `  <sitemap><loc>${u}</loc></sitemap>`).join("\n")}
</sitemapindex>`;
}

const xml = { "content-type": "application/xml" };

describe("runCrawl — sitemap discovery (SA-RC21 finding #3)", () => {
  let fixture: FixtureServer;

  // Start with just "/" every time — the server's own origin isn't known until after it's
  // listening, so any route whose body needs to self-reference it (e.g. a sitemap listing this
  // same server's URLs) is added afterward via `fixture.routes[...] = ...`.
  beforeEach(async () => {
    fixture = await startFixtureServer({ "/": { body: page("Home", "") } });
  });

  afterEach(async () => {
    await fixture.close();
  });

  it("discovers pages from a regular <urlset> sitemap", async () => {
    fixture.routes["/sitemap.xml"] = { headers: xml, body: urlset([`${fixture.url}/orphan`]) };

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 20, maxDepth: 3, concurrency: 2 },
      { dispatcher: testAgent },
    );

    expect(result.sitemapUrls).toContain(`${fixture.url}/orphan`);
  });

  it("recursively walks a <sitemapindex> into its child sitemaps", async () => {
    fixture.routes["/sitemap.xml"] = {
      headers: xml,
      body: sitemapIndex([`${fixture.url}/sitemap-a.xml`, `${fixture.url}/sitemap-b.xml`]),
    };
    fixture.routes["/sitemap-a.xml"] = { headers: xml, body: urlset([`${fixture.url}/from-a`]) };
    fixture.routes["/sitemap-b.xml"] = { headers: xml, body: urlset([`${fixture.url}/from-b`]) };

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 20, maxDepth: 3, concurrency: 2 },
      { dispatcher: testAgent },
    );

    expect(result.sitemapUrls.sort()).toEqual([`${fixture.url}/from-a`, `${fixture.url}/from-b`].sort());
  });

  it("follows nested sitemap indexes (index -> index -> leaf)", async () => {
    fixture.routes["/sitemap.xml"] = {
      headers: xml,
      body: sitemapIndex([`${fixture.url}/sitemap-mid.xml`]),
    };
    fixture.routes["/sitemap-mid.xml"] = {
      headers: xml,
      body: sitemapIndex([`${fixture.url}/sitemap-leaf.xml`]),
    };
    fixture.routes["/sitemap-leaf.xml"] = { headers: xml, body: urlset([`${fixture.url}/deeply-nested`]) };

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 20, maxDepth: 3, concurrency: 2 },
      { dispatcher: testAgent },
    );

    expect(result.sitemapUrls).toContain(`${fixture.url}/deeply-nested`);
  });

  it("crawls a page that is only discoverable via the sitemap (a true orphan, no internal link)", async () => {
    fixture.routes["/"] = { body: page("Home", "<p>No links at all.</p>") };
    fixture.routes["/orphan"] = { body: page("Orphan", "") };
    fixture.routes["/sitemap.xml"] = { headers: xml, body: urlset([`${fixture.url}/orphan`]) };

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 20, maxDepth: 3, concurrency: 2 },
      { dispatcher: testAgent },
    );

    const urls = result.pages.map((p) => p.normalizedUrl);
    expect(urls).toContain(`${fixture.url}/orphan`);
    expect(result.pages.find((p) => p.normalizedUrl.endsWith("/orphan"))?.facts?.title).toBe("Orphan");
  });

  it("crawls a URL present in both an internal link and the sitemap exactly once", async () => {
    fixture.routes["/"] = { body: page("Home", '<a href="/shared">Shared</a>') };
    fixture.routes["/shared"] = { body: page("Shared", "") };
    fixture.routes["/sitemap.xml"] = { headers: xml, body: urlset([`${fixture.url}/shared`]) };

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 20, maxDepth: 3, concurrency: 2 },
      { dispatcher: testAgent },
    );

    const sharedPages = result.pages.filter((p) => p.normalizedUrl.endsWith("/shared"));
    expect(sharedPages).toHaveLength(1);
  });

  it("never fetches or crawls a foreign-origin URL declared in the sitemap", async () => {
    fixture.routes["/sitemap.xml"] = {
      headers: xml,
      body: urlset(["https://foreign-origin.example.invalid/evil"]),
    };

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 20, maxDepth: 3, concurrency: 2 },
      { dispatcher: testAgent },
    );

    expect(result.sitemapUrls).toHaveLength(0);
    expect(
      result.pages.some((p) => p.normalizedUrl.includes("foreign-origin.example.invalid")),
    ).toBe(false);
  });

  it("degrades gracefully (no crash, no discovered URLs) for a malformed sitemap", async () => {
    fixture.routes["/sitemap.xml"] = { headers: xml, body: "<this is not><<valid xml at all" };

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 20, maxDepth: 3, concurrency: 2 },
      { dispatcher: testAgent },
    );

    expect(result.sitemapUrls).toHaveLength(0);
    // The crawl itself still succeeds via ordinary link discovery — a broken sitemap must not
    // take down the whole crawl.
    expect(result.pages.some((p) => p.normalizedUrl === `${fixture.url}/`)).toBe(true);
  });

  it("bounds sitemap-index expansion instead of fetching an unbounded number of child sitemaps", async () => {
    // 40 child sitemaps declared — comfortably above MAX_SITEMAP_FILES (25) once the index itself
    // is counted — each with a distinct URL, to prove not all of them get walked.
    const childUrls = Array.from({ length: 40 }, (_, i) => `${fixture.url}/sitemap-${i}.xml`);
    fixture.routes["/sitemap.xml"] = { headers: xml, body: sitemapIndex(childUrls) };
    for (let i = 0; i < 40; i++) {
      fixture.routes[`/sitemap-${i}.xml`] = { headers: xml, body: urlset([`${fixture.url}/page-${i}`]) };
    }

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 1000, maxDepth: 3, concurrency: 4 },
      { dispatcher: testAgent },
    );

    // MAX_SITEMAP_FILES caps total sitemap fetches at 25, one of which is the index itself, so at
    // most 24 leaf sitemaps (and therefore at most 24 discovered URLs) — well short of all 40.
    expect(result.sitemapUrls.length).toBeLessThan(40);
    expect(result.sitemapUrls.length).toBeLessThanOrEqual(24);
  });

  it("still respects maxPages when the sitemap alone offers more orphan pages than the cap", async () => {
    const orphanUrls = Array.from({ length: 10 }, (_, i) => `${fixture.url}/orphan-${i}`);
    fixture.routes["/sitemap.xml"] = { headers: xml, body: urlset(orphanUrls) };
    for (let i = 0; i < 10; i++) {
      fixture.routes[`/orphan-${i}`] = { body: page(`Orphan ${i}`, "") };
    }

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 3, maxDepth: 3, concurrency: 2 },
      { dispatcher: testAgent },
    );

    expect(result.pages.length).toBeLessThanOrEqual(3);
  });
});

describe("runCrawl — cancellation propagation (SA-RC21 finding #4)", () => {
  let fixture: FixtureServer;

  beforeEach(async () => {
    fixture = await startFixtureServer({
      "/": { body: page("Home", "") },
      "/slow": { body: page("Slow", ""), delayMs: 2000 },
    });
  });

  afterEach(async () => {
    await fixture.close();
  });

  it("aborts an in-flight request instead of waiting for it to complete", async () => {
    const controller = new AbortController();

    const runPromise = runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: `${fixture.url}/slow`, maxPages: 5, maxDepth: 1, concurrency: 1 },
      { dispatcher: testAgent, signal: controller.signal },
    );

    // Abort shortly after the request starts, well before the fixture's 2s delayed response —
    // if cancellation only stopped *new* work (the pre-fix behavior), this would still take ~2s.
    setTimeout(() => controller.abort(), 100);

    const start = Date.now();
    const result = await runPromise;
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(1500);
    // The in-flight request was aborted — it either never completed as a normal page or is
    // recorded with a fetch error, never a clean 200.
    const slowPage = result.pages.find((p) => p.normalizedUrl === `${fixture.url}/slow`);
    if (slowPage) {
      expect(slowPage.statusCode).not.toBe(200);
    }
  });
});
