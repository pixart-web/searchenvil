import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { prisma } from "@searchanvil/database";
import { createTestApp, extractCookieHeader, extractCookieValue, uniqueEmail } from "./test-app";

interface Session {
  cookieHeader: string;
  csrfToken: string;
  organizationId: string;
}

async function registerAndGetSession(server: unknown, label: string): Promise<Session> {
  const res = await request(server as never)
    .post("/api/v1/auth/register")
    .send({
      email: uniqueEmail(label),
      password: "correct horse battery staple",
      name: label,
      organizationName: `${label} Org`,
    });
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const cookieHeader = extractCookieHeader(cookies);
  const orgs = await request(server as never).get("/api/v1/organizations").set("Cookie", cookieHeader);
  return {
    cookieHeader,
    csrfToken: extractCookieValue(cookies, "searchanvil_csrf") ?? "",
    organizationId: orgs.body[0].id,
  };
}

describe("Performance (e2e)", () => {
  let app: INestApplication;
  let alice: Session;
  let bob: Session;
  let projectId: string;

  const performanceBase = (session: Session) =>
    `/api/v1/organizations/${session.organizationId}/projects/${projectId}/performance`;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    alice = await registerAndGetSession(server, "perfalice");
    bob = await registerAndGetSession(server, "perfbob");

    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Performance Test Project" });
    projectId = projectRes.body.id;

    const siteRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Site", rootUrl: "https://perf-test.example.com" });

    const crawl = await prisma.crawl.create({
      data: { siteId: siteRes.body.id, status: "COMPLETED", config: {}, maxPages: 200, maxDepth: 5 },
    });

    const sampled = await prisma.crawlPage.create({
      data: {
        crawlId: crawl.id,
        requestedUrl: "https://perf-test.example.com/",
        normalizedUrl: "https://perf-test.example.com/",
        finalUrl: "https://perf-test.example.com/",
        statusCode: 200,
        title: "Home",
        isIndexable: true,
      },
    });
    // A second crawled page that was never sampled (beyond the sampling cap) —
    // it must count toward totalPagesCrawled but never appear in `samples`.
    await prisma.crawlPage.create({
      data: {
        crawlId: crawl.id,
        requestedUrl: "https://perf-test.example.com/unsampled",
        normalizedUrl: "https://perf-test.example.com/unsampled",
        finalUrl: "https://perf-test.example.com/unsampled",
        statusCode: 200,
        isIndexable: true,
      },
    });

    await prisma.pagePerformance.create({
      data: {
        pageId: sampled.id,
        status: "COMPLETED",
        ttfbMs: 120,
        domContentLoadedMs: 300,
        loadTimeMs: 320,
        lcpMs: 1500,
        cls: 0.02,
        analyzedAt: new Date(),
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns sampled performance rows plus the true total crawled-page count", async () => {
    const server = app.getHttpServer();
    const res = await request(server).get(performanceBase(alice)).set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.totalPagesCrawled).toBe(2);
    expect(res.body.samples).toHaveLength(1);
    expect(res.body.samples[0].status).toBe("COMPLETED");
    expect(res.body.samples[0].lcpMs).toBe(1500);
    expect(res.body.samples[0].page.normalizedUrl).toBe("https://perf-test.example.com/");
  });

  it("blocks a foreign user from viewing performance data for this project", async () => {
    const server = app.getHttpServer();
    const res = await request(server).get(performanceBase(alice)).set("Cookie", bob.cookieHeader);
    expect(res.status).toBe(403);
  });

  it("returns an empty sample set for a project with no completed crawl", async () => {
    const server = app.getHttpServer();
    const otherProjectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "No Crawl Project" });

    const res = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}/projects/${otherProjectRes.body.id}/performance`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.crawlId).toBeNull();
    expect(res.body.samples).toHaveLength(0);
  });
});
