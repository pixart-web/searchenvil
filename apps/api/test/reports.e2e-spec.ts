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

describe("Reports (e2e)", () => {
  let app: INestApplication;
  let alice: Session;
  let bob: Session;
  let projectId: string;
  let crawlId: string;

  const reportsBase = (session: Session) =>
    `/api/v1/organizations/${session.organizationId}/projects/${projectId}/reports`;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    alice = await registerAndGetSession(server, "reportsalice");
    bob = await registerAndGetSession(server, "reportsbob");

    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Reports Test Project" });
    projectId = projectRes.body.id;

    const siteRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Site", rootUrl: "https://reports-test.example.com" });

    const crawl = await prisma.crawl.create({
      data: {
        siteId: siteRes.body.id,
        status: "COMPLETED",
        config: {},
        maxPages: 200,
        maxDepth: 5,
        finishedAt: new Date(),
      },
    });
    crawlId = crawl.id;

    const page = await prisma.crawlPage.create({
      data: {
        crawlId: crawl.id,
        requestedUrl: "https://reports-test.example.com/",
        normalizedUrl: "https://reports-test.example.com/",
        finalUrl: "https://reports-test.example.com/",
        statusCode: 404,
        isIndexable: false,
      },
    });

    const rule = await prisma.auditRule.upsert({
      where: { ruleKey: "http-4xx-error-reports-itest" },
      create: {
        ruleKey: "http-4xx-error-reports-itest",
        name: "Broken page, with a \"quote\" and, a comma",
        category: "TECHNICAL",
        defaultSeverity: "HIGH",
        defaultEffort: "MEDIUM",
        weight: 8,
        description: "d",
        whyItMatters: "w",
        recommendation: "Fix it, please — see \"the guide\".",
      },
      update: {},
    });

    const auditRun = await prisma.auditRun.create({
      data: {
        crawlId: crawl.id,
        rulesetVersion: "test",
        status: "COMPLETED",
        score: {
          create: {
            scoringVersion: "test",
            overallScore: 82,
            categoryScores: { TECHNICAL: 70 },
            explanation: {},
          },
        },
      },
    });

    const issue = await prisma.auditIssue.create({
      data: {
        auditRunId: auditRun.id,
        ruleId: rule.id,
        severity: "HIGH",
        impact: "HIGH",
        effort: "MEDIUM",
        affectedPageCount: 1,
        title: 'Broken page, with a "quote" and, a comma',
        summary: "404",
        priorityScore: 42,
      },
    });
    await prisma.auditOccurrence.create({
      data: { auditIssueId: issue.id, pageId: page.id, evidence: {} },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it("lists completed, scored crawls for the project's primary site", async () => {
    const server = app.getHttpServer();
    const res = await request(server).get(reportsBase(alice)).set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].crawlId).toBe(crawlId);
    expect(res.body[0].overallScore).toBe(82);
  });

  it("returns a full report: site, crawl, score, and issues ranked by priority", async () => {
    const server = app.getHttpServer();
    const res = await request(server).get(`${reportsBase(alice)}/${crawlId}`).set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.site.rootUrl).toBe("https://reports-test.example.com");
    expect(res.body.score.overallScore).toBe(82);
    expect(res.body.previousCrawl).toBeNull();
    expect(res.body.scoreDelta).toBeNull();
    expect(res.body.issues).toHaveLength(1);
    expect(res.body.issues[0].ruleKey).toBe("http-4xx-error-reports-itest");
    expect(res.body.issues[0].recommendation).toContain("Fix it");
  });

  it("exports the same issues as a well-formed CSV, escaping quotes and commas", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${reportsBase(alice)}/${crawlId}/export.csv`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toContain("attachment");

    const lines = (res.text as string).trim().split("\r\n");
    expect(lines[0]).toBe(
      "Rule Key,Category,Severity,Impact,Effort,Affected Pages,Priority Score,Title,Recommendation",
    );
    expect(lines[1]).toContain("http-4xx-error-reports-itest");
    // The title contains a comma and an embedded quote — must come back RFC4180-quoted with the
    // inner quote doubled, not silently corrupting the CSV's column structure.
    expect(lines[1]).toContain('"Broken page, with a ""quote"" and, a comma"');
  });

  it("blocks a foreign user from listing or reading reports for this project", async () => {
    const server = app.getHttpServer();
    const listRes = await request(server).get(reportsBase(alice)).set("Cookie", bob.cookieHeader);
    expect(listRes.status).toBe(403);

    const getRes = await request(server)
      .get(`${reportsBase(alice)}/${crawlId}`)
      .set("Cookie", bob.cookieHeader);
    expect(getRes.status).toBe(403);
  });

  it("404s for a crawl id that doesn't belong to this project", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${reportsBase(alice)}/00000000-0000-0000-0000-000000000000`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(404);
  });
});
