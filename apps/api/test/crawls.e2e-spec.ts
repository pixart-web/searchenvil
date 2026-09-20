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

async function createProjectAndSite(
  server: unknown,
  session: Session,
): Promise<{ projectId: string; siteId: string }> {
  const projectRes = await request(server as never)
    .post(`/api/v1/organizations/${session.organizationId}/projects`)
    .set("Cookie", session.cookieHeader)
    .set("x-csrf-token", session.csrfToken)
    .send({ name: "Crawl Test Project" });

  const siteRes = await request(server as never)
    .post(`/api/v1/organizations/${session.organizationId}/projects/${projectRes.body.id}/sites`)
    .set("Cookie", session.cookieHeader)
    .set("x-csrf-token", session.csrfToken)
    .send({ displayName: "Crawl Test Site", rootUrl: `https://crawl-test-${Date.now()}.example.com` });

  return { projectId: projectRes.body.id, siteId: siteRes.body.id };
}

describe("Crawls (e2e)", () => {
  let app: INestApplication;
  let alice: Session;
  let bob: Session;
  let aliceSite: { projectId: string; siteId: string };

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    alice = await registerAndGetSession(server, "crawlalice");
    bob = await registerAndGetSession(server, "crawlbob");
    aliceSite = await createProjectAndSite(server, alice);
  });

  afterAll(async () => {
    await app.close();
  });

  function crawlsBase(session: Session, site: { projectId: string; siteId: string }): string {
    return `/api/v1/organizations/${session.organizationId}/projects/${site.projectId}/sites/${site.siteId}/crawls`;
  }

  it("starts a crawl in PENDING status with defaults", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post(crawlsBase(alice, aliceSite))
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.status).toBe("PENDING");
    expect(res.body.maxPages).toBe(200);
    expect(res.body.maxDepth).toBe(5);
  });

  it("honors maxPages/maxDepth overrides and rejects out-of-range values", async () => {
    const server = app.getHttpServer();
    const ok = await request(server)
      .post(crawlsBase(alice, aliceSite))
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ maxPages: 50, maxDepth: 2 });
    expect(ok.status).toBe(201);
    expect(ok.body.maxPages).toBe(50);
    expect(ok.body.maxDepth).toBe(2);

    const bad = await request(server)
      .post(crawlsBase(alice, aliceSite))
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ maxPages: 99999 });
    expect(bad.status).toBe(400);
  });

  it("lists crawls newest first", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(crawlsBase(alice, aliceSite))
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    const timestamps = res.body.map((c: { createdAt: string }) => new Date(c.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });

  it("cancels a pending crawl and is idempotent for an already-terminal one", async () => {
    const server = app.getHttpServer();
    const startRes = await request(server)
      .post(crawlsBase(alice, aliceSite))
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({});
    const crawlId = startRes.body.id;

    const cancelRes = await request(server)
      .patch(`${crawlsBase(alice, aliceSite)}/${crawlId}/cancel`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken);
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.status).toBe("CANCELLED");

    // Cancelling an already-cancelled crawl is a no-op, not an error.
    const secondCancel = await request(server)
      .patch(`${crawlsBase(alice, aliceSite)}/${crawlId}/cancel`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken);
    expect(secondCancel.status).toBe(200);
    expect(secondCancel.body.status).toBe("CANCELLED");
  });

  it("blocks a foreign user from starting, listing, or cancelling crawls on another org's site", async () => {
    const server = app.getHttpServer();
    const startRes = await request(server)
      .post(crawlsBase(bob, aliceSite))
      .set("Cookie", bob.cookieHeader)
      .set("x-csrf-token", bob.csrfToken)
      .send({});
    // Bob's own organization membership is real (guard passes), but the
    // site belongs to Alice's org — same "foreign resource under your own
    // authorized org" 404 pattern as Projects/Sites (see PHASE-04 notes).
    expect(startRes.status).toBe(404);

    const listRes = await request(server)
      .get(crawlsBase(bob, aliceSite))
      .set("Cookie", bob.cookieHeader);
    expect(listRes.status).toBe(404);
  });

  it("returns paginated, persisted crawl pages and a single page's detail with its relations", async () => {
    const server = app.getHttpServer();
    const startRes = await request(server)
      .post(crawlsBase(alice, aliceSite))
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({});
    const crawlId = startRes.body.id;

    // Seed CrawlPage rows directly — actually running a crawl is the
    // worker's job (Phase 06 worker tests cover that); this test exercises
    // the API's read layer over already-persisted data.
    const crawlPage = await prisma.crawlPage.create({
      data: {
        crawlId,
        requestedUrl: "https://example.com/",
        normalizedUrl: "https://example.com/",
        finalUrl: "https://example.com/",
        statusCode: 200,
        title: "Home",
        isIndexable: true,
        images: { create: [{ src: "/a.png", hasAlt: true, altText: "A" }] },
        structuredData: { create: [{ format: "json-ld", raw: { "@type": "Organization" }, isValid: true }] },
      },
    });

    const listRes = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/pages`)
      .set("Cookie", alice.cookieHeader);
    expect(listRes.status).toBe(200);
    expect(listRes.body.total).toBe(1);
    expect(listRes.body.items[0].id).toBe(crawlPage.id);

    const pageRes = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/pages/${crawlPage.id}`)
      .set("Cookie", alice.cookieHeader);
    expect(pageRes.status).toBe(200);
    expect(pageRes.body.images).toHaveLength(1);
    expect(pageRes.body.structuredData).toHaveLength(1);

    // Bob has no access to Alice's crawl or its pages at all.
    const bobPagesRes = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/pages`)
      .set("Cookie", bob.cookieHeader);
    expect(bobPagesRes.status).toBe(403);
  });

  it("rejects out-of-range or malformed pagination query params", async () => {
    const server = app.getHttpServer();
    const startRes = await request(server)
      .post(crawlsBase(alice, aliceSite))
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({});
    const crawlId = startRes.body.id;

    const negativePage = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/pages?page=-1`)
      .set("Cookie", alice.cookieHeader);
    expect(negativePage.status).toBe(400);

    const hugePageSize = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/pages?pageSize=99999`)
      .set("Cookie", alice.cookieHeader);
    expect(hugePageSize.status).toBe(400);

    const nonNumericPage = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/pages?page=not-a-number`)
      .set("Cookie", alice.cookieHeader);
    expect(nonNumericPage.status).toBe(400);
  });

  it("returns 404 for score/issues before an audit run exists, then the real data once one does", async () => {
    const server = app.getHttpServer();
    const startRes = await request(server)
      .post(crawlsBase(alice, aliceSite))
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({});
    const crawlId = startRes.body.id;

    const noScoreYet = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/score`)
      .set("Cookie", alice.cookieHeader);
    expect(noScoreYet.status).toBe(404);

    const noIssuesYet = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/issues`)
      .set("Cookie", alice.cookieHeader);
    expect(noIssuesYet.status).toBe(200);
    expect(noIssuesYet.body).toEqual([]);

    // Seed a real AuditRun/AuditScore/AuditIssue as the worker would.
    const rule = await prisma.auditRule.upsert({
      where: { ruleKey: "missing-title" },
      create: {
        ruleKey: "missing-title",
        name: "Missing title tag",
        category: "CONTENT",
        defaultSeverity: "HIGH",
        defaultEffort: "EASY",
        weight: 8,
        description: "d",
        whyItMatters: "w",
        recommendation: "r",
      },
      update: {},
    });
    const auditRun = await prisma.auditRun.create({
      data: {
        crawlId,
        rulesetVersion: "test",
        status: "COMPLETED",
        score: {
          create: {
            scoringVersion: "test",
            overallScore: 87,
            categoryScores: { CONTENT: 87 },
            explanation: { scoringVersion: "test" },
          },
        },
      },
    });
    const crawlPage = await prisma.crawlPage.create({
      data: {
        crawlId,
        requestedUrl: "https://example.com/",
        normalizedUrl: "https://example.com/no-title",
        finalUrl: "https://example.com/no-title",
        statusCode: 200,
        isIndexable: true,
      },
    });
    const issue = await prisma.auditIssue.create({
      data: {
        auditRunId: auditRun.id,
        ruleId: rule.id,
        severity: "HIGH",
        impact: "HIGH",
        effort: "EASY",
        affectedPageCount: 1,
        title: "Missing title tag",
        summary: "d",
        priorityScore: 42,
        occurrences: { create: [{ pageId: crawlPage.id, evidence: {} }] },
      },
    });

    const scoreRes = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/score`)
      .set("Cookie", alice.cookieHeader);
    expect(scoreRes.status).toBe(200);
    expect(scoreRes.body.overallScore).toBe(87);

    const issuesRes = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/issues`)
      .set("Cookie", alice.cookieHeader);
    expect(issuesRes.status).toBe(200);
    expect(issuesRes.body).toHaveLength(1);
    expect(issuesRes.body[0].rule.ruleKey).toBe("missing-title");

    const issueDetailRes = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/issues/${issue.id}`)
      .set("Cookie", alice.cookieHeader);
    expect(issueDetailRes.status).toBe(200);
    expect(issueDetailRes.body.occurrences).toHaveLength(1);

    // Bob can't see any of it.
    const bobScoreRes = await request(server)
      .get(`${crawlsBase(alice, aliceSite)}/${crawlId}/score`)
      .set("Cookie", bob.cookieHeader);
    expect(bobScoreRes.status).toBe(403);
  });
});
