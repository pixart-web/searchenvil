"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Spinner, StatusState } from "@searchanvil/ui";
import { apiFetch } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import { formatRelativeTime } from "@/lib/format";
import type { ReportListItem } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 90) return "success";
  if (score >= 70) return "warning";
  return "danger";
}

export default function ReportsListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): React.ReactElement {
  const { projectId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [reports, setReports] = useState<ReportListItem[] | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const data = await resolveProjectOrg(projectId, (orgId) =>
          apiFetch<ReportListItem[]>(`/organizations/${orgId}/projects/${projectId}/reports`),
        );
        if (!cancelled) {
          setReports(data);
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

  if (state === "error" || !reports) {
    return (
      <StatusState
        kind="error"
        title="Couldn't load reports"
        description="It may not exist, or you may not have access to it."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-steel-100">Reports</h1>
        <p className="text-sm text-steel-400">
          A shareable snapshot of Search Health and issues for any completed, scored crawl.
        </p>
      </div>

      {reports.length === 0 ? (
        <StatusState
          kind="empty"
          title="No reports available yet"
          description="A report becomes available once a crawl's audit finishes with a score."
        />
      ) : (
        <div className="space-y-2">
          {reports.map((report) => (
            <Link
              key={report.crawlId}
              href={`/app/projects/${projectId}/reports/${report.crawlId}`}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded border border-forge-800 px-4 py-3 hover:border-steel-500"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm font-medium text-steel-100">{formatRelativeTime(report.finishedAt)}</p>
                <p className="text-xs text-steel-500">{report.pagesCrawled} pages crawled</p>
              </div>
              <Badge tone={scoreTone(report.overallScore)}>Score {report.overallScore}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
