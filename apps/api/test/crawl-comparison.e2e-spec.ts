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

async function upsertRule(ruleKey: string) {
  return prisma.auditRule.upsert({
    where: { ruleKey },
    create: {
      ruleKey,
      name: ruleKey,
      category: "TECHNICAL",
      defaultSeverity: "HIGH",
      defaultEffort: "MEDIUM",
      weight: 8,
      description: "d",
      whyItMatters: "w",
      recommendation: "r",
    },
    update: {},
  });
}

describe("Crawl Comparison (e2e)", () => {
  let app: INestApplication;
  let alice: Session;
  let bob: Session;
  let projectId: string;
  let siteId: string;
  let baselineCrawlId: string;
  let currentCrawlId: string;

  const crawlsBase = (session: Session) =>
    `/api/v1/organizations/${session.organizationId}/projects/${projectId}/sites/${siteId}/crawls`;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    alice = await registerAndGetSession(server, "comparealice");
    bob = await registerAndGetSession(server, "comparebob");

    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Comparison Test Project" });
    projectId = projectRes.body.id;

    const siteRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Site", rootUrl: "https://compare-test.example.com" });
    siteId = siteRes.body.id;

    // --- Baseline crawl: home (persisting issue) + broken (resolved by next crawl) ---
    const baselineCrawl = await prisma.crawl.create({
      data: { siteId, status: "COMPLETED", config: {}, maxPages: 200, maxDepth: 5, finishedAt: new Date("2026-01-01") },
    });
    baselineCrawlId = baselineCrawl.id;

    const baselineHome = await prisma.crawlPage.create({
      data: {
        crawlId: baselineCrawl.id,
        requestedUrl: "https://compare-test.example.com/",
        normalizedUrl: "https://compare-test.example.com/",
        finalUrl: "https://compare-test.example.com/",
        statusCode: 200,
        isIndexable: true,
      },
    });
    const baselineBroken = await prisma.crawlPage.create({
      data: {
        crawlId: baselineCrawl.id,
        requestedUrl: "https://compare-test.example.com/broken",
        normalizedUrl: "https://compare-test.example.com/broken",
        finalUrl: "https://compare-test.example.com/broken",
        statusCode: 404,
        isIndexable: false,
      },
    });

    const persistingRule = await upsertRule("persisting-issue-itest");
    const resolvedRule = await upsertRule("resolved-issue-itest");

    const baselineRun = await prisma.auditRun.create({
      data: {
        crawlId: baselineCrawl.id,
        rulesetVersion: "test",
        status: "COMPLETED",
        score: {
          create: {
            scoringVersion: "test",
            overallScore: 70,
            categoryScores: { TECHNICAL: 60, CONTENT: 80 },
            explanation: {},
          },
        },
      },
    });

    const baselinePersistingIssue = await prisma.auditIssue.create({
      data: {
        auditRunId: baselineRun.id,
        ruleId: persistingRule.id,
        severity: "HIGH",
        impact: "HIGH",
        effort: "MEDIUM",
        affectedPageCount: 1,
        title: "Persisting issue",
        summary: "still here",
        priorityScore: 40,
      },
    });
    await prisma.auditOccurrence.create({
      data: { auditIssueId: baselinePersistingIssue.id, pageId: baselineHome.id, evidence: {} },
    });

    const baselineResolvedIssue = await prisma.auditIssue.create({
      data: {
        auditRunId: baselineRun.id,
        ruleId: resolvedRule.id,
        severity: "HIGH",
        impact: "HIGH",
        effort: "MEDIUM",
        affectedPageCount: 1,
        title: "Resolved issue",
        summary: "will be fixed",
        priorityScore: 30,
      },
    });
    await prisma.auditOccurrence.create({
      data: { auditIssueId: baselineResolvedIssue.id, pageId: baselineBroken.id, evidence: {} },
    });

    // --- Current crawl: home still has the persisting issue; broken is gone; a new page has a new issue ---
    const currentCrawl = await prisma.crawl.create({
      data: { siteId, status: "COMPLETED", config: {}, maxPages: 200, maxDepth: 5, finishedAt: new Date("2026-02-01") },
    });
    currentCrawlId = currentCrawl.id;

    const currentHome = await prisma.crawlPage.create({
      data: {
        crawlId: currentCrawl.id,
        requestedUrl: "https://compare-test.example.com/",
        normalizedUrl: "https://compare-test.example.com/",
        finalUrl: "https://compare-test.example.com/",
        statusCode: 200,
        isIndexable: true,
      },
    });
    const currentNewPage = await prisma.crawlPage.create({
      data: {
        crawlId: currentCrawl.id,
        requestedUrl: "https://compare-test.example.com/new",
        normalizedUrl: "https://compare-test.example.com/new",
        finalUrl: "https://compare-test.example.com/new",
        statusCode: 200,
        isIndexable: true,
      },
    });

    const newRule = await upsertRule("new-issue-itest");

    const currentRun = await prisma.auditRun.create({
      data: {
        crawlId: currentCrawl.id,
        rulesetVersion: "test",
        status: "COMPLETED",
        score: {
          create: {
            scoringVersion: "test",
            overallScore: 85,
            categoryScores: { TECHNICAL: 90, CONTENT: 80 },
            explanation: {},
          },
        },
      },
    });

    const currentPersistingIssue = await prisma.auditIssue.create({
      data: {
        auditRunId: currentRun.id,
        ruleId: persistingRule.id,
        severity: "HIGH",
        impact: "HIGH",
        effort: "MEDIUM",
        affectedPageCount: 1,
        title: "Persisting issue",
        summary: "still here",
        priorityScore: 40,
      },
    });
    await prisma.auditOccurrence.create({
      data: { auditIssueId: currentPersistingIssue.id, pageId: currentHome.id, evidence: {} },
    });

    const currentNewIssue = await prisma.auditIssue.create({
      data: {
        auditRunId: currentRun.id,
        ruleId: newRule.id,
        severity: "MEDIUM",
        impact: "MEDIUM",
        effort: "EASY",
        affectedPageCount: 1,
        title: "New issue",
        summary: "just appeared",
        priorityScore: 20,
      },
    });
    await prisma.auditOccurrence.create({
      data: { auditIssueId: currentNewIssue.id, pageId: currentNewPage.id, evidence: {} },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("compares against the previous completed crawl by default", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${crawlsBase(alice)}/${currentCrawlId}/compare`)
      .set("Cookie", alice.cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.baseline.crawlId).toBe(baselineCrawlId);
    expect(res.body.current.crawlId).toBe(currentCrawlId);
    expect(res.body.scoreDelta).toBe(15);
    expect(res.body.categoryDeltas.TECHNICAL).toBe(30);
    expect(res.body.categoryDeltas.CONTENT).toBe(0);

    expect(res.body.issues.new.map((i: { ruleKey: string }) => i.ruleKey)).toEqual(["new-issue-itest"]);
    expect(res.body.issues.resolved.map((i: { ruleKey: string }) => i.ruleKey)).toEqual(["resolved-issue-itest"]);
    expect(res.body.issues.persisting.map((i: { ruleKey: string }) => i.ruleKey)).toEqual([
      "persisting-issue-itest",
    ]);

    // "/" is matched in both crawls and had the same 1-issue count before and after → not
    // improved or worsened. "/broken" only existed in the baseline (removed). "/new" only exists
    // in the current crawl (added).
    expect(res.body.pages.matchedUrlCount).toBe(1);
    expect(res.body.pages.removedPageCount).toBe(1);
    expect(res.body.pages.newPageCount).toBe(1);
    expect(res.body.pages.improved).toHaveLength(0);
    expect(res.body.pages.worsened).toHaveLength(0);
  });

  it("compares against an explicit baseline crawl id", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${crawlsBase(alice)}/${currentCrawlId}/compare?baselineCrawlId=${baselineCrawlId}`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.baseline.crawlId).toBe(baselineCrawlId);
  });

  it("404s when there is no earlier completed crawl to compare against", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${crawlsBase(alice)}/${baselineCrawlId}/compare`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(404);
  });

  it("blocks a foreign user from comparing crawls for this project", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${crawlsBase(alice)}/${currentCrawlId}/compare`)
      .set("Cookie", bob.cookieHeader);
    expect(res.status).toBe(403);
  });

  it("rejects a malformed baselineCrawlId instead of passing it through to the database", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${crawlsBase(alice)}/${currentCrawlId}/compare?baselineCrawlId=not-a-uuid`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(400);
  });
});
