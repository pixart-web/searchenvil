"use client";

import { use, useEffect, useState } from "react";
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner, StatusState, type BadgeSeverity } from "@searchanvil/ui";
import { apiFetch, apiUrl } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import { formatCategoryLabel, formatRelativeTime } from "@/lib/format";
import type { Report } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 90) return "success";
  if (score >= 70) return "warning";
  return "danger";
}

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; crawlId: string }>;
}): React.ReactElement {
  const { projectId, crawlId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [report, setReport] = useState<Report | undefined>();
  const [orgId, setOrgId] = useState<string | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const data = await resolveProjectOrg(projectId, async (resolvedOrgId) => {
          const result = await apiFetch<Report>(
            `/organizations/${resolvedOrgId}/projects/${projectId}/reports/${crawlId}`,
          );
          return { resolvedOrgId, result };
        });
        if (!cancelled) {
          setReport(data.result);
          setOrgId(data.resolvedOrgId);
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

  if (state === "error" || !report || !orgId) {
    return (
      <StatusState
        kind="error"
        title="Couldn't load this report"
        description="It may not exist, or the crawl may not have a completed, scored audit yet."
      />
    );
  }

  const categories = Object.entries(report.score.categoryScores).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-4 print:space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-steel-100">Search Health Report</h1>
          <p className="text-sm text-steel-400">
            {report.site.displayName} · {report.site.rootUrl}
          </p>
          <p className="text-xs text-steel-500">{formatRelativeTime(report.crawl.finishedAt)}</p>
        </div>
        <a
          href={apiUrl(`/organizations/${orgId}/projects/${projectId}/reports/${crawlId}/export.csv`)}
          className="shrink-0 rounded border border-forge-700 px-3 py-1.5 text-xs font-medium text-steel-300 hover:border-steel-500 hover:text-steel-100 print:hidden"
        >
          Download CSV
        </a>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Search Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone={scoreTone(report.score.overallScore)}>Overall {report.score.overallScore}</Badge>
            {report.previousCrawl && report.scoreDelta !== null ? (
              <span className="text-sm text-steel-400">
                {report.scoreDelta > 0 ? "+" : ""}
                {report.scoreDelta} since {formatRelativeTime(report.previousCrawl.finishedAt)}
              </span>
            ) : null}
          </div>
          <div className="mt-4 space-y-1">
            {categories.map(([category, score]) => (
              <div key={category} className="flex items-center justify-between text-sm">
                <span className="text-steel-400">{formatCategoryLabel(category)}</span>
                <span className="text-steel-200">{score}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Issues ({report.issues.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {report.issues.length === 0 ? (
            <p className="text-sm text-steel-500">No issues found — this crawl came back clean.</p>
          ) : (
            <ul className="divide-y divide-forge-800">
              {report.issues.map((issue) => (
                <li key={issue.ruleKey} className="space-y-1 py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-steel-100">{issue.title}</span>
                    <Badge severity={issue.severity.toLowerCase() as BadgeSeverity}>{issue.severity}</Badge>
                    <Badge tone="neutral">{formatCategoryLabel(issue.category)}</Badge>
                    <span className="text-xs text-steel-500">
                      {issue.affectedPageCount} page{issue.affectedPageCount === 1 ? "" : "s"} affected
                    </span>
                  </div>
                  <p className="text-sm text-steel-400">{issue.summary}</p>
                  <p className="text-xs text-steel-500">{issue.recommendation}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
