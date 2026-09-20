import { afterAll, afterEach, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@searchanvil/database";
import type { SiteInput } from "@searchanvil/audit-engine";
import { processAuditJob } from "./process-audit-job";

async function seedCompletedCrawl(): Promise<{ crawlId: string; cleanup: () => Promise<void> }> {
  const suffix = randomUUID();
  const user = await prisma.user.create({
    data: { email: `audit-test-${suffix}@searchanvil.test`, name: "Audit Test", passwordHash: "x" },
  });
  const org = await prisma.organization.create({
    data: {
      name: `Audit Test Org ${suffix}`,
      slug: `audit-test-org-${suffix}`,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  const project = await prisma.project.create({ data: { organizationId: org.id, name: "Audit Test Project" } });
  const site = await prisma.site.create({
    data: { projectId: project.id, displayName: "Test Site", rootUrl: `https://audit-${suffix}.example.com` },
  });
  const crawl = await prisma.crawl.create({
    data: { siteId: site.id, status: "COMPLETED", config: {}, maxPages: 200, maxDepth: 5 },
  });

  return {
    crawlId: crawl.id,
    cleanup: async () => {
      await prisma.organization.delete({ where: { id: org.id } });
    },
  };
}

describe("processAuditJob", () => {
  const cleanups: (() => Promise<void>)[] = [];

  afterEach(async () => {
    while (cleanups.length > 0) {
      const cleanup = cleanups.pop();
      await cleanup?.();
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates an AuditRun with AuditIssues and AuditOccurrences for a fixture site with known defects", async () => {
    const { crawlId, cleanup } = await seedCompletedCrawl();
    cleanups.push(cleanup);

    // AuditOccurrence.pageId is a real foreign key to CrawlPage, so the
    // fixture needs an actual persisted page row, not just a SiteInput
    // fabricated in memory.
    const crawlPage = await prisma.crawlPage.create({
      data: {
        crawlId,
        requestedUrl: "https://example.com/",
        normalizedUrl: "https://example.com/",
        finalUrl: "https://example.com/",
        statusCode: 200,
        isIndexable: true,
      },
    });

    const fakeSite: SiteInput = {
      sitemapUrls: [],
      robotsTxtFound: true,
      pages: [
        {
          id: crawlPage.id,
          url: "https://example.com/",
          statusCode: 200,
          contentType: "text/html",
          title: undefined, // deliberate: missing title
          metaDescription: "A perfectly fine description within the recommended length range for this page.",
          headings: [],
          canonicalUrl: "https://example.com/",
          metaRobots: undefined,
          xRobotsTag: undefined,
          language: "en",
          wordCount: 500,
          isIndexable: true,
          depth: 0,
          fetchError: undefined,
          redirectChain: [],
          images: [],
          structuredData: [],
          outboundLinks: [],
          performance: undefined,
        },
      ],
    };

    await processAuditJob({ prisma, buildSiteInput: async () => fakeSite }, crawlId);

    const auditRun = await prisma.auditRun.findUniqueOrThrow({ where: { crawlId } });
    expect(auditRun.status).toBe("COMPLETED");
    expect(auditRun.finishedAt).toBeTruthy();

    const issues = await prisma.auditIssue.findMany({ where: { auditRunId: auditRun.id }, include: { rule: true } });
    const missingTitleIssue = issues.find((i) => i.rule.ruleKey === "missing-title");
    expect(missingTitleIssue).toBeTruthy();
    expect(missingTitleIssue?.affectedPageCount).toBe(1);

    const missingH1Issue = issues.find((i) => i.rule.ruleKey === "missing-h1");
    expect(missingH1Issue).toBeTruthy();

    const occurrences = await prisma.auditOccurrence.findMany({
      where: { auditIssueId: missingTitleIssue?.id },
    });
    expect(occurrences).toHaveLength(1);
    expect(occurrences[0]?.pageId).toBe(crawlPage.id);

    expect(missingTitleIssue?.severity).toBe("HIGH");
    expect(missingTitleIssue?.priorityScore).toBeGreaterThan(0);
    expect(["HIGH", "MEDIUM", "LOW"]).toContain(missingTitleIssue?.impact);

    const score = await prisma.auditScore.findUniqueOrThrow({ where: { auditRunId: auditRun.id } });
    expect(score.overallScore).toBeGreaterThanOrEqual(0);
    expect(score.overallScore).toBeLessThan(100); // this fixture has real defects
    expect(score.categoryScores).toHaveProperty("CONTENT");
    expect(score.explanation).toHaveProperty("scoringVersion");
  });

  it("produces no AuditIssue rows for a clean site", async () => {
    const { crawlId, cleanup } = await seedCompletedCrawl();
    cleanups.push(cleanup);

    const cleanSite: SiteInput = {
      sitemapUrls: ["https://example.com/sitemap.xml"],
      robotsTxtFound: true,
      pages: [
        {
          id: "home",
          url: "https://example.com/",
          statusCode: 200,
          contentType: "text/html",
          title: "A Perfectly Reasonable Title For This Page",
          metaDescription:
            "A meta description of a perfectly reasonable length that sits comfortably within the recommended range.",
          headings: [{ level: 1, text: "Welcome" }],
          canonicalUrl: "https://example.com/",
          metaRobots: undefined,
          xRobotsTag: undefined,
          language: "en",
          wordCount: 500,
          isIndexable: true,
          depth: 0,
          fetchError: undefined,
          redirectChain: [],
          images: [],
          structuredData: [],
          outboundLinks: [],
          performance: undefined,
        },
      ],
    };

    await processAuditJob({ prisma, buildSiteInput: async () => cleanSite }, crawlId);

    const auditRun = await prisma.auditRun.findUniqueOrThrow({ where: { crawlId } });
    const issues = await prisma.auditIssue.findMany({ where: { auditRunId: auditRun.id } });
    expect(issues).toHaveLength(0);
    expect(auditRun.status).toBe("COMPLETED");

    const score = await prisma.auditScore.findUniqueOrThrow({ where: { auditRunId: auditRun.id } });
    expect(score.overallScore).toBe(100);
  });

  it("marks the AuditRun FAILED when building the site input throws", async () => {
    const { crawlId, cleanup } = await seedCompletedCrawl();
    cleanups.push(cleanup);

    await processAuditJob(
      {
        prisma,
        buildSiteInput: async () => {
          throw new Error("could not load pages");
        },
      },
      crawlId,
    );

    const auditRun = await prisma.auditRun.findUniqueOrThrow({ where: { crawlId } });
    expect(auditRun.status).toBe("FAILED");
    expect(auditRun.errorMessage).toBe("could not load pages");
  });

  it("does not create a second AuditRun for a crawl that already has a completed one", async () => {
    const { crawlId, cleanup } = await seedCompletedCrawl();
    cleanups.push(cleanup);

    const site: SiteInput = { sitemapUrls: [], robotsTxtFound: true, pages: [] };
    await processAuditJob({ prisma, buildSiteInput: async () => site }, crawlId);
    await processAuditJob({ prisma, buildSiteInput: async () => site }, crawlId);

    const runs = await prisma.auditRun.findMany({ where: { crawlId } });
    expect(runs).toHaveLength(1);
  });
});
