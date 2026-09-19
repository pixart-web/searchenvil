import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Agent } from "undici";
import { runCrawl } from "./crawler";
import { DEFAULT_CRAWL_CONFIG } from "./types";
import { startFixtureServer, type FixtureServer } from "./fixtures/fixture-server";

const testAgent = new Agent();

function page(title: string, body: string): string {
  return `<html><head><title>${title}</title></head><body>${body}</body></html>`;
}

describe("runCrawl (deterministic fixture site)", () => {
  let fixture: FixtureServer;

  beforeEach(async () => {
    fixture = await startFixtureServer({});
  });

  afterEach(async () => {
    await fixture.close();
  });

  it("crawls every internal page, respects robots.txt, and never follows external links", async () => {
    await fixture.close();
    fixture = await startFixtureServer({
      "/": {
        body: page(
          "Home",
          `<h1>Home</h1>
           <a href="/about">About</a>
           <a href="/contact">Contact</a>
           <a href="/blocked">Blocked</a>
           <a href="/redirect-page">Redirect</a>
           <a href="/missing">Missing</a>
           <a href="https://external.example.com/">External</a>`,
        ),
      },
      "/about": { body: page("About", '<h1>About Us</h1><a href="/">Home</a>') },
      "/contact": { body: page("Contact", "<h1>Contact</h1>") },
      "/blocked": { body: page("Blocked", "<h1>Should not be crawled</h1>") },
      "/redirect-page": { status: 302, headers: { location: "/about" } },
      "/robots.txt": {
        headers: { "content-type": "text/plain" },
        body: "User-agent: *\nDisallow: /blocked\nSitemap: /sitemap.xml\n",
      },
    });

    const result = await runCrawl(
      {
        ...DEFAULT_CRAWL_CONFIG,
        startUrl: fixture.url,
        maxPages: 20,
        maxDepth: 3,
        concurrency: 2,
      },
      { dispatcher: testAgent },
    );

    const normalizedUrls = result.pages.map((p) => p.normalizedUrl).sort();
    expect(normalizedUrls).toEqual(
      [`${fixture.url}/`, `${fixture.url}/about`, `${fixture.url}/contact`, `${fixture.url}/redirect-page`, `${fixture.url}/missing`].sort(),
    );

    // /blocked must never be fetched at all — robots.txt disallows it.
    expect(result.pages.some((p) => p.normalizedUrl.endsWith("/blocked"))).toBe(false);

    // external.example.com must never be fetched — not same-origin.
    expect(result.pages.some((p) => p.normalizedUrl.includes("external.example.com"))).toBe(false);

    expect(result.robotsTxtFound).toBe(true);

    const home = result.pages.find((p) => p.normalizedUrl === `${fixture.url}/`);
    expect(home?.facts?.title).toBe("Home");
    expect(home?.facts?.headings).toEqual([{ level: 1, text: "Home" }]);

    const redirectPage = result.pages.find((p) => p.normalizedUrl.endsWith("/redirect-page"));
    expect(redirectPage?.statusCode).toBe(200);
    expect(redirectPage?.finalUrl).toBe(`${fixture.url}/about`);
    expect(redirectPage?.redirectChain).toEqual([`${fixture.url}/redirect-page`]);

    const missingPage = result.pages.find((p) => p.normalizedUrl.endsWith("/missing"));
    expect(missingPage?.statusCode).toBe(404);
    expect(missingPage?.fetchError).toBeUndefined();
  });

  it("never crawls the same normalized URL twice even when reachable via multiple links", async () => {
    await fixture.close();
    fixture = await startFixtureServer({
      "/": { body: page("Home", '<a href="/a">A</a><a href="/b">B</a>') },
      "/a": { body: page("A", '<a href="/b">B again</a><a href="/">Home again</a>') },
      "/b": { body: page("B", '<a href="/a">A again</a>') },
    });

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 20, maxDepth: 5, concurrency: 3 },
      { dispatcher: testAgent },
    );

    expect(result.pages).toHaveLength(3);
    const counts = new Map<string, number>();
    result.pages.forEach((p) => counts.set(p.normalizedUrl, (counts.get(p.normalizedUrl) ?? 0) + 1));
    expect([...counts.values()].every((count) => count === 1)).toBe(true);
  });

  it("stops discovering new pages once maxPages is reached", async () => {
    await fixture.close();
    fixture = await startFixtureServer({
      "/": { body: page("Home", '<a href="/p1">1</a><a href="/p2">2</a><a href="/p3">3</a>') },
      "/p1": { body: page("P1", "") },
      "/p2": { body: page("P2", "") },
      "/p3": { body: page("P3", "") },
    });

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 2, maxDepth: 5, concurrency: 1 },
      { dispatcher: testAgent },
    );

    expect(result.pages.length).toBeLessThanOrEqual(2);
  });

  it("stops discovering new links once maxDepth is reached", async () => {
    await fixture.close();
    fixture = await startFixtureServer({
      "/": { body: page("Home", '<a href="/depth1">1</a>') },
      "/depth1": { body: page("D1", '<a href="/depth2">2</a>') },
      "/depth2": { body: page("D2", '<a href="/depth3">3</a>') },
      "/depth3": { body: page("D3", "") },
    });

    const result = await runCrawl(
      { ...DEFAULT_CRAWL_CONFIG, startUrl: fixture.url, maxPages: 20, maxDepth: 1, concurrency: 1 },
      { dispatcher: testAgent },
    );

    const urls = result.pages.map((p) => p.normalizedUrl);
    expect(urls).toContain(`${fixture.url}/`);
    expect(urls).toContain(`${fixture.url}/depth1`);
    expect(urls).not.toContain(`${fixture.url}/depth2`);
    expect(urls).not.toContain(`${fixture.url}/depth3`);
  });
});
