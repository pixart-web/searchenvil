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

describe("Pages (e2e)", () => {
  let app: INestApplication;
  let alice: Session;
  let bob: Session;
  let projectId: string;
  let homeId: string;
  let brokenId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    alice = await registerAndGetSession(server, "pagesalice");
    bob = await registerAndGetSession(server, "pagesbob");

    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Pages Test Project" });
    projectId = projectRes.body.id;

    const siteRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Site", rootUrl: "https://pages-test.example.com" });

    const crawl = await prisma.crawl.create({
      data: { siteId: siteRes.body.id, status: "COMPLETED", config: {}, maxPages: 200, maxDepth: 5 },
    });

    const home = await prisma.crawlPage.create({
      data: {
        crawlId: crawl.id,
        requestedUrl: "https://pages-test.example.com/",
        normalizedUrl: "https://pages-test.example.com/",
        finalUrl: "https://pages-test.example.com/",
        statusCode: 200,
        title: "Home",
        isIndexable: true,
        images: { create: [{ src: "/logo.png", hasAlt: true, altText: "Logo" }] },
      },
    });
    const broken = await prisma.crawlPage.create({
      data: {
        crawlId: crawl.id,
        requestedUrl: "https://pages-test.example.com/missing",
        normalizedUrl: "https://pages-test.example.com/missing",
        finalUrl: "https://pages-test.example.com/missing",
        statusCode: 404,
        isIndexable: false,
      },
    });
    await prisma.crawlLink.create({
      data: {
        crawlId: crawl.id,
        sourcePageId: home.id,
        targetPageId: broken.id,
        targetUrl: broken.normalizedUrl,
        isInternal: true,
        anchorText: "Missing",
      },
    });

    const rule = await prisma.auditRule.upsert({
      where: { ruleKey: "http-4xx-error-pages-itest" },
      create: {
        ruleKey: "http-4xx-error-pages-itest",
        name: "Broken page",
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
    const auditRun = await prisma.auditRun.create({
      data: { crawlId: crawl.id, rulesetVersion: "test", status: "COMPLETED" },
    });
    const issue = await prisma.auditIssue.create({
      data: {
        auditRunId: auditRun.id,
        ruleId: rule.id,
        severity: "HIGH",
        impact: "HIGH",
        effort: "MEDIUM",
        affectedPageCount: 1,
        title: "Broken page",
        summary: "404",
        priorityScore: 42,
      },
    });
    await prisma.auditOccurrence.create({
      data: { auditIssueId: issue.id, pageId: broken.id, evidence: { statusCode: 404 } },
    });

    homeId = home.id;
    brokenId = broken.id;
  });

  afterAll(async () => {
    await app.close();
  });

  function pagesBase(session: Session): string {
    return `/api/v1/organizations/${session.organizationId}/projects/${projectId}/pages`;
  }

  it("lists all crawled pages, alphabetically by URL", async () => {
    const server = app.getHttpServer();
    const res = await request(server).get(pagesBase(alice)).set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.items.map((p: { id: string }) => p.id)).toEqual([homeId, brokenId]);
  });

  it("filters by status class", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${pagesBase(alice)}?statusClass=4xx`)
      .set("Cookie", alice.cookieHeader);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(brokenId);
  });

  it("filters to indexable-only pages", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${pagesBase(alice)}?indexableOnly=true`)
      .set("Cookie", alice.cookieHeader);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(homeId);
  });

  it("searches by URL substring", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${pagesBase(alice)}?search=missing`)
      .set("Cookie", alice.cookieHeader);
    expect(res.body.total).toBe(1);
    expect(res.body.items[0].id).toBe(brokenId);
  });

  it("paginates results", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${pagesBase(alice)}?pageSize=1&page=2`)
      .set("Cookie", alice.cookieHeader);
    expect(res.body.total).toBe(2);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0].id).toBe(brokenId);
  });

  it("returns a full technical profile for a page: facts, inbound links, and affecting issues", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${pagesBase(alice)}/${brokenId}`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(200);
    expect(res.body.statusCode).toBe(404);
    expect(res.body.inboundLinkCount).toBe(1);
    expect(res.body.issues).toHaveLength(1);
    expect(res.body.issues[0].ruleKey).toBe("http-4xx-error-pages-itest");
  });

  it("returns images on the page's technical profile", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`${pagesBase(alice)}/${homeId}`)
      .set("Cookie", alice.cookieHeader);
    expect(res.body.images).toHaveLength(1);
    expect(res.body.images[0].altText).toBe("Logo");
    expect(res.body.inboundLinkCount).toBe(0);
    expect(res.body.issues).toHaveLength(0);
  });

  it("blocks a foreign user from listing or viewing pages for this project", async () => {
    const server = app.getHttpServer();
    const listRes = await request(server).get(pagesBase(alice)).set("Cookie", bob.cookieHeader);
    expect(listRes.status).toBe(403);

    const detailRes = await request(server)
      .get(`${pagesBase(alice)}/${homeId}`)
      .set("Cookie", bob.cookieHeader);
    expect(detailRes.status).toBe(403);
  });

  it("returns 404 for a page id that exists but belongs to a different project", async () => {
    const server = app.getHttpServer();
    const otherProjectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Other Pages Project" });

    const res = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}/projects/${otherProjectRes.body.id}/pages/${homeId}`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(404);
  });
});
