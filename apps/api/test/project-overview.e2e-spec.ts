import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { prisma } from "@searchenvil/database";
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
    csrfToken: extractCookieValue(cookies, "searchenvil_csrf") ?? "",
    organizationId: orgs.body[0].id,
  };
}

describe("Project overview (e2e)", () => {
  let app: INestApplication;
  let alice: Session;
  let bob: Session;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    alice = await registerAndGetSession(server, "overviewalice");
    bob = await registerAndGetSession(server, "overviewbob");
  });

  afterAll(async () => {
    await app.close();
  });

  it("returns an empty-but-valid overview for a project with a site but no crawls yet", async () => {
    const server = app.getHttpServer();
    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "No Crawls Yet" });
    const projectId = projectRes.body.id;

    await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Site", rootUrl: "https://no-crawls.example.com" });

    const res = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/overview`)
      .set("Cookie", alice.cookieHeader);

    expect(res.status).toBe(200);
    expect(res.body.sites).toHaveLength(1);
    expect(res.body.sites[0].latestCrawl).toBeNull();
    expect(res.body.sites[0].recentCrawls).toEqual([]);
  });

  it("surfaces the latest scored crawl's Search Health and top Forge Priorities", async () => {
    const server = app.getHttpServer();
    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Scored Project" });
    const projectId = projectRes.body.id;

    const siteRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Site", rootUrl: "https://scored.example.com" });
    const siteId = siteRes.body.id;

    const crawl = await prisma.crawl.create({
      data: { siteId, status: "COMPLETED", config: {}, maxPages: 200, maxDepth: 5, pagesCrawled: 3 },
    });
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
        crawlId: crawl.id,
        rulesetVersion: "test",
        status: "COMPLETED",
        score: {
          create: {
            scoringVersion: "test",
            overallScore: 82,
            categoryScores: { CONTENT: 82 },
            explanation: {},
          },
        },
      },
    });
    await prisma.auditIssue.create({
      data: {
        auditRunId: auditRun.id,
        ruleId: rule.id,
        severity: "HIGH",
        impact: "HIGH",
        effort: "EASY",
        affectedPageCount: 2,
        title: "Missing title tag",
        summary: "d",
        priorityScore: 20,
      },
    });

    const res = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/overview`)
      .set("Cookie", alice.cookieHeader);

    expect(res.status).toBe(200);
    const site = res.body.sites[0];
    expect(site.latestCrawl.score.overallScore).toBe(82);
    expect(site.latestCrawl.topIssues).toHaveLength(1);
    expect(site.latestCrawl.topIssues[0].ruleKey).toBe("missing-title");
    expect(site.latestCrawl.issuesByCategory.CONTENT).toBe(1);
    expect(site.recentCrawls).toHaveLength(1);
    expect(site.recentCrawls[0].overallScore).toBe(82);
  });

  it("blocks a foreign user from seeing another organization's project overview", async () => {
    const server = app.getHttpServer();
    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Private Project" });

    const res = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}/projects/${projectRes.body.id}/overview`)
      .set("Cookie", bob.cookieHeader);
    expect(res.status).toBe(403);
  });
});
