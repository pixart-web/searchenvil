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

async function seedRule(ruleKey: string, category: string, severity: string) {
  return prisma.auditRule.upsert({
    where: { ruleKey },
    create: {
      ruleKey,
      name: ruleKey,
      category: category as never,
      defaultSeverity: severity as never,
      defaultEffort: "EASY",
      weight: 5,
      description: "d",
      whyItMatters: "w",
      recommendation: "r",
    },
    update: {},
  });
}

describe("Issues (e2e)", () => {
  let app: INestApplication;
  let alice: Session;
  let bob: Session;
  let projectId: string;
  let issueIds: Record<string, string>;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    alice = await registerAndGetSession(server, "issuesalice");
    bob = await registerAndGetSession(server, "issuesbob");

    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Issues Test Project" });
    projectId = projectRes.body.id;

    const siteRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Site", rootUrl: "https://issues-test.example.com" });

    const crawl = await prisma.crawl.create({
      data: { siteId: siteRes.body.id, status: "COMPLETED", config: {}, maxPages: 200, maxDepth: 5 },
    });
    const auditRun = await prisma.auditRun.create({
      data: { crawlId: crawl.id, rulesetVersion: "test", status: "COMPLETED" },
    });

    const criticalRule = await seedRule("http-5xx-error-itest", "TECHNICAL", "CRITICAL");
    const contentRule = await seedRule("missing-title-itest", "CONTENT", "HIGH");
    const lowRule = await seedRule("low-word-count-itest", "CONTENT", "NOTICE");

    const critical = await prisma.auditIssue.create({
      data: {
        auditRunId: auditRun.id,
        ruleId: criticalRule.id,
        severity: "CRITICAL",
        impact: "HIGH",
        effort: "MEDIUM",
        affectedPageCount: 5,
        title: "Server error",
        summary: "Pages return 500",
        priorityScore: 100,
      },
    });
    const contentIssue = await prisma.auditIssue.create({
      data: {
        auditRunId: auditRun.id,
        ruleId: contentRule.id,
        severity: "HIGH",
        impact: "MEDIUM",
        effort: "EASY",
        affectedPageCount: 2,
        title: "Missing title tag",
        summary: "Pages have no title",
        priorityScore: 50,
      },
    });
    const lowIssue = await prisma.auditIssue.create({
      data: {
        auditRunId: auditRun.id,
        ruleId: lowRule.id,
        severity: "NOTICE",
        impact: "LOW",
        effort: "HARD",
        affectedPageCount: 1,
        title: "Thin content",
        summary: "Low word count",
        priorityScore: 5,
      },
    });

    const page = await prisma.crawlPage.create({
      data: {
        crawlId: crawl.id,
        requestedUrl: "https://issues-test.example.com/",
        normalizedUrl: "https://issues-test.example.com/",
        finalUrl: "https://issues-test.example.com/",
        statusCode: 500,
        isIndexable: true,
      },
    });
    await prisma.auditOccurrence.create({
      data: { auditIssueId: critical.id, pageId: page.id, evidence: { statusCode: 500 } },
    });

    issueIds = { critical: critical.id, content: contentIssue.id, low: lowIssue.id };
  });

  afterAll(async () => {
    await app.close();
  });

  function issuesBase(session: Session): string {
    return `/api/v1/organizations/${session.organizationId}/projects/${projectId}/issues`;
  }

  it("lists all issues ranked by priority (descending) by default", async () => {
    const server = app.getHttpServer();
    const res = await request(server).get(issuesBase(alice)).set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((i: { id: string }) => i.id)).toEqual([
      issueIds.critical,
      issueIds.content,
      issueIds.low,
    ]);
  });

  it("filters by severity", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${issuesBase(alice)}?severity=CRITICAL`)
      .set("Cookie", alice.cookieHeader);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(issueIds.critical);
  });

  it("filters by multiple severities via comma-separated values", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${issuesBase(alice)}?severity=CRITICAL,NOTICE`)
      .set("Cookie", alice.cookieHeader);
    expect(res.body).toHaveLength(2);
  });

  it("filters by category", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${issuesBase(alice)}?category=CONTENT`)
      .set("Cookie", alice.cookieHeader);
    expect(res.body).toHaveLength(2);
    expect(res.body.every((i: { id: string }) => [issueIds.content, issueIds.low].includes(i.id))).toBe(true);
  });

  it("searches by title/summary substring, case-insensitively", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${issuesBase(alice)}?search=title`)
      .set("Cookie", alice.cookieHeader);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(issueIds.content);
  });

  it("sorts by affected page count ascending", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${issuesBase(alice)}?sortBy=affectedPages&sortOrder=asc`)
      .set("Cookie", alice.cookieHeader);
    expect(res.body.map((i: { id: string }) => i.id)).toEqual([
      issueIds.low,
      issueIds.content,
      issueIds.critical,
    ]);
  });

  it("rejects an invalid severity value", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${issuesBase(alice)}?severity=NOT_A_SEVERITY`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(400);
  });

  it("returns issue detail with affected pages and evidence", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${issuesBase(alice)}/${issueIds.critical}`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.rule.ruleKey).toBe("http-5xx-error-itest");
    expect(res.body.occurrences).toHaveLength(1);
    expect(res.body.occurrences[0].evidence).toEqual({ statusCode: 500 });
    expect(res.body.occurrences[0].page.normalizedUrl).toBe("https://issues-test.example.com/");
  });

  it("blocks a foreign user from listing or viewing issues for this project", async () => {
    const server = app.getHttpServer();
    const listRes = await request(server).get(issuesBase(alice)).set("Cookie", bob.cookieHeader);
    expect(listRes.status).toBe(403);

    const detailRes = await request(server)
      .get(`${issuesBase(alice)}/${issueIds.critical}`)
      .set("Cookie", bob.cookieHeader);
    expect(detailRes.status).toBe(403);
  });

  it("returns 404 for an issue id that exists but belongs to a different project", async () => {
    const server = app.getHttpServer();
    const otherProjectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Other Project" });

    const res = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}/projects/${otherProjectRes.body.id}/issues/${issueIds.critical}`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(404);
  });
});
