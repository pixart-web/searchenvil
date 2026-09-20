"use client";

import { use, useEffect, useState } from "react";
import {
  Badge,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  SearchHealthGauge,
  Spinner,
  StatusState,
} from "@searchanvil/ui";
import { apiFetch } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import { formatCategoryLabel, formatRelativeTime } from "@/lib/format";
import type { ProjectOverview, SiteOverview } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

export default function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): React.ReactElement {
  const { projectId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [overview, setOverview] = useState<ProjectOverview | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const data = await resolveProjectOrg(projectId, (orgId) =>
          apiFetch<ProjectOverview>(`/organizations/${orgId}/projects/${projectId}/overview`),
        );
        if (!cancelled) {
          setOverview(data);
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  if (state === "loading") {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (state === "error" || !overview) {
    return (
      <StatusState
        kind="error"
        title="Couldn't load this project"
        description="It may not exist, or you may not have access to it."
      />
    );
  }

  const site = overview.sites[0];

  if (!site) {
    return (
      <StatusState
        kind="empty"
        title="No website added yet"
        description="Add a website to this project to start auditing it."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-steel-100">{overview.project.name}</h1>
        <p className="text-sm text-steel-400">{site.rootUrl}</p>
      </div>

      {site.latestCrawl ? <SiteOverviewContent site={site} /> : <NoCrawlsYet />}
    </div>
  );
}

function NoCrawlsYet(): React.ReactElement {
  return (
    <StatusState
      kind="empty"
      title="No audits yet"
      description="Run a crawl to see Search Health and Forge Priorities for this site."
    />
  );
}

function SiteOverviewContent({ site }: { site: SiteOverview }): React.ReactElement {
  const crawl = site.latestCrawl;
  if (!crawl) return <NoCrawlsYet />;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Search Health</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <SearchHealthGauge score={crawl.score.overallScore} />
          <div className="w-full space-y-2">
            {Object.entries(crawl.score.categoryScores).map(([category, score]) => (
              <div key={category} className="flex items-center justify-between text-xs">
                <span className="text-steel-400">{formatCategoryLabel(category)}</span>
                <span className="font-mono text-steel-300">{score}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Forge Priorities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {crawl.topIssues.length === 0 ? (
            <p className="text-sm text-steel-400">No issues found on the latest crawl.</p>
          ) : (
            crawl.topIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded border border-forge-800 px-3 py-2"
              >
                <div className="min-w-0 flex-1 basis-40">
                  <p className="truncate text-sm font-medium text-steel-100">{issue.title}</p>
                  <p className="text-xs text-steel-500">
                    {issue.affectedPageCount} affected page{issue.affectedPageCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={issue.impact === "HIGH" ? "danger" : issue.impact === "MEDIUM" ? "warning" : "neutral"}>
                    {issue.impact} IMPACT
                  </Badge>
                  <Badge tone="neutral">{issue.effort}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Issues by category</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(crawl.issuesByCategory).length === 0 ? (
            <p className="text-sm text-steel-400">No issues to categorize.</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(crawl.issuesByCategory).map(([category, count]) => (
                <div key={category} className="flex items-center justify-between text-sm">
                  <span className="text-steel-300">{formatCategoryLabel(category)}</span>
                  <span className="font-mono text-steel-400">{count}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Recent crawls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {site.recentCrawls.map((recent) => (
            <div key={recent.id} className="flex items-center justify-between text-sm">
              <span className="text-steel-400">{formatRelativeTime(recent.finishedAt ?? recent.createdAt)}</span>
              <span className="font-mono text-steel-300">
                {recent.overallScore ?? "—"}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
