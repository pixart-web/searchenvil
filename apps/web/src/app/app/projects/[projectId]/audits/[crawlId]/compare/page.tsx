"use client";

import { use, useEffect, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner, StatusState } from "@searchenvil/ui";
import { apiFetch } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import { formatCategoryLabel, formatRelativeTime } from "@/lib/format";
import type { ComparisonIssueSummary, CrawlComparison, ProjectOverview } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

function deltaTone(delta: number | null): "success" | "warning" | "danger" | "neutral" {
  if (delta === null) return "neutral";
  if (delta > 0) return "success";
  if (delta < 0) return "danger";
  return "neutral";
}

function formatDelta(delta: number | null): string {
  if (delta === null) return "—";
  if (delta === 0) return "±0";
  return delta > 0 ? `+${delta}` : String(delta);
}

function IssueList({ title, issues, tone }: { title: string; issues: ComparisonIssueSummary[]; tone: "success" | "warning" | "danger" }): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {title} ({issues.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {issues.length === 0 ? (
          <p className="text-sm text-steel-500">None.</p>
        ) : (
          <ul className="space-y-2">
            {issues.map((issue) => (
              <li key={issue.ruleKey} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                <span className="min-w-0 flex-1 basis-32 truncate text-steel-200">{issue.title}</span>
                <Badge tone={tone}>{issue.severity}</Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function CrawlComparisonPage({
  params,
}: {
  params: Promise<{ projectId: string; crawlId: string }>;
}): React.ReactElement {
  const { projectId, crawlId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [comparison, setComparison] = useState<CrawlComparison | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const data = await resolveProjectOrg(projectId, async (orgId) => {
          const overview = await apiFetch<ProjectOverview>(`/organizations/${orgId}/projects/${projectId}/overview`);
          const site = overview.sites[0];
          if (!site) throw new Error("No site for this project.");
          return apiFetch<CrawlComparison>(
            `/organizations/${orgId}/projects/${projectId}/sites/${site.id}/crawls/${crawlId}/compare`,
          );
        });
        if (!cancelled) {
          setComparison(data);
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
  }, [projectId, crawlId]);

  if (state === "loading") {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (state === "error" || !comparison) {
    return (
      <StatusState
        kind="error"
        title="Couldn't load this comparison"
        description="Both crawls need a completed audit with a score to compare."
      />
    );
  }

  const categories = Object.keys(comparison.categoryDeltas).sort();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-steel-100">Crawl Comparison</h1>
        <p className="text-sm text-steel-400">
          {formatRelativeTime(comparison.baseline.finishedAt)} → {formatRelativeTime(comparison.current.finishedAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-sm text-steel-400">
              {comparison.baseline.overallScore} → {comparison.current.overallScore}
            </span>
            <Badge tone={deltaTone(comparison.scoreDelta)}>{formatDelta(comparison.scoreDelta)}</Badge>
          </div>
          <div className="mt-4 space-y-1">
            {categories.map((category) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <span className="text-steel-400">{formatCategoryLabel(category)}</span>
                <span className="flex items-center gap-2">
                  <span className="text-steel-500">
                    {comparison.baseline.categoryScores[category] ?? "—"} →{" "}
                    {comparison.current.categoryScores[category] ?? "—"}
                  </span>
                  <Badge tone={deltaTone(comparison.categoryDeltas[category] ?? null)}>
                    {formatDelta(comparison.categoryDeltas[category] ?? null)}
                  </Badge>
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <IssueList title="New issues" issues={comparison.issues.new} tone="danger" />
        <IssueList title="Resolved issues" issues={comparison.issues.resolved} tone="success" />
        <IssueList title="Persisting issues" issues={comparison.issues.persisting} tone="warning" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Pages</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-steel-400">
            {comparison.pages.matchedUrlCount} page{comparison.pages.matchedUrlCount === 1 ? "" : "s"} present in
            both crawls · {comparison.pages.newPageCount} new · {comparison.pages.removedPageCount} removed
          </p>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1 text-sm font-medium text-steel-200">Improved ({comparison.pages.improved.length})</p>
              {comparison.pages.improved.length === 0 ? (
                <p className="text-sm text-steel-500">None.</p>
              ) : (
                <ul className="space-y-1">
                  {comparison.pages.improved.map((page) => (
                    <li key={page.url} className="truncate text-sm text-steel-300">
                      {page.url} ({page.baselineIssueCount} → {page.currentIssueCount})
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-steel-200">Worsened ({comparison.pages.worsened.length})</p>
              {comparison.pages.worsened.length === 0 ? (
                <p className="text-sm text-steel-500">None.</p>
              ) : (
                <ul className="space-y-1">
                  {comparison.pages.worsened.map((page) => (
                    <li key={page.url} className="truncate text-sm text-steel-300">
                      {page.url} ({page.baselineIssueCount} → {page.currentIssueCount})
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
