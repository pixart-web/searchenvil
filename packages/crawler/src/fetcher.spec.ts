import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Agent } from "undici";
import { safeFetch } from "./fetcher";
import { startFixtureServer, type FixtureServer } from "./fixtures/fixture-server";

const testAgent = new Agent(); // no SSRF-safe lookup — deliberate, see FetchOptions.dispatcher

describe("safeFetch", () => {
  let fixture: FixtureServer;

  beforeEach(async () => {
    fixture = await startFixtureServer({
      "/": { body: "<html><body>Home</body></html>" },
      "/redirect-once": { status: 302, headers: { location: "/" } },
      "/redirect-loop-a": { status: 302, headers: { location: "/redirect-loop-b" } },
      "/redirect-loop-b": { status: 302, headers: { location: "/redirect-loop-a" } },
      "/500": { status: 500, body: "Internal Server Error" },
    });
  });

  afterEach(async () => {
    await fixture.close();
  });

  it("fetches a page and reports its status/body/content-type", async () => {
    const result = await safeFetch(fixture.url, {
      userAgent: "test-agent",
      timeoutMs: 5000,
      dispatcher: testAgent,
    });
    expect(result.statusCode).toBe(200);
    expect(result.body).toContain("Home");
    expect(result.contentType).toContain("text/html");
    expect(result.fetchError).toBeUndefined();
    expect(result.redirectChain).toEqual([]);
    expect(result.finalUrl).toBe(fixture.url);
  });

  it("follows a redirect and records the chain", async () => {
    const result = await safeFetch(`${fixture.url}/redirect-once`, {
      userAgent: "test-agent",
      timeoutMs: 5000,
      dispatcher: testAgent,
    });
    expect(result.statusCode).toBe(200);
    expect(result.finalUrl).toBe(fixture.url + "/");
    expect(result.redirectChain).toEqual([`${fixture.url}/redirect-once`]);
  });

  it("reports too-many-redirects instead of looping forever", async () => {
    const result = await safeFetch(`${fixture.url}/redirect-loop-a`, {
      userAgent: "test-agent",
      timeoutMs: 5000,
      dispatcher: testAgent,
    });
    expect(result.statusCode).toBeUndefined();
    expect(result.fetchError).toMatch(/too many redirects/i);
  });

  it("reports a server error status without treating it as a fetch failure", async () => {
    const result = await safeFetch(`${fixture.url}/500`, {
      userAgent: "test-agent",
      timeoutMs: 5000,
      dispatcher: testAgent,
    });
    expect(result.statusCode).toBe(500);
    expect(result.fetchError).toBeUndefined();
  });

  it("reports a connection failure for an unreachable port as a fact, not a throw", async () => {
    const result = await safeFetch("http://127.0.0.1:1", {
      userAgent: "test-agent",
      timeoutMs: 2000,
      dispatcher: testAgent,
    });
    expect(result.statusCode).toBeUndefined();
    expect(result.fetchError).toBeTruthy();
  });

  it("blocks loopback addresses by default (no dispatcher override) — real SSRF protection, not just unit-tested logic", async () => {
    const result = await safeFetch(fixture.url, {
      userAgent: "test-agent",
      timeoutMs: 2000,
    });
    expect(result.statusCode).toBeUndefined();
    expect(result.fetchError).toMatch(/non-public address|refusing to fetch/i);
  });
});
