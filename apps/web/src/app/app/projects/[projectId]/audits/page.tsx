"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Button, Spinner, StatusState } from "@searchanvil/ui";
import { apiFetch, ApiError } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import { formatRelativeTime } from "@/lib/format";
import type { ProjectOverview } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

const desktop = process.env.NEXT_PUBLIC_SEARCHANVIL_DESKTOP === "1";
const activeStatuses = new Set(["PENDING", "DISCOVERING", "CRAWLING", "ANALYZING", "SCORING"]);

function statusTone(status: string): "success" | "warning" | "danger" | "neutral" {
  if (status === "COMPLETED") return "success";
  if (status === "FAILED") return "danger";
  if (activeStatuses.has(status)) return "warning";
  return "neutral";
}

function scoreTone(score: number | null): "success" | "warning" | "danger" | "neutral" {
  if (score === null) return "neutral";
  if (score >= 90) return "success";
  if (score >= 70) return "warning";
  return "danger";
}

export default function AuditsListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): React.ReactElement {
  const { projectId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [overview, setOverview] = useState<ProjectOverview | undefined>();
  const [action, setAction] = useState<string>();
  const [actionError, setActionError] = useState<string>();
  const [revision, setRevision] = useState(0);

  async function changeCrawl(siteId: string, crawlId?: string): Promise<void> {
    setAction(crawlId ?? "start");
    setActionError(undefined);
    try {
      await resolveProjectOrg(projectId, (orgId) => {
        const path = `/organizations/${orgId}/projects/${projectId}/sites/${siteId}/crawls`;
        return crawlId
          ? apiFetch(path + `/${crawlId}/cancel`, { method: "PATCH" })
          : apiFetch(path, { method: "POST", body: {} });
      });
      setRevision((current) => current + 1);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Could not update the crawl.");
    } finally {
      setAction(undefined);
    }
  }

  useEffect(() => {
    let cancelled = false;
    let refresh: ReturnType<typeof setTimeout> | undefined;
    async function load(): Promise<void> {
      try {
        const data = await resolveProjectOrg(projectId, (orgId) =>
          apiFetch<ProjectOverview>(`/organizations/${orgId}/projects/${projectId}/overview`),
        );
        if (!cancelled) {
          setOverview(data);
          setState("ready");
          if (
            desktop &&
            data.sites[0]?.recentCrawls.some(
              (crawl) =>
                activeStatuses.has(crawl.status) ||
                (crawl.status === "COMPLETED" &&
                  crawl.overallScore === null &&
                  crawl.auditStatus !== "FAILED" &&
                  Date.now() - Date.parse(crawl.finishedAt ?? crawl.createdAt) < 120_000),
            )
          )
            refresh = setTimeout(() => void load(), 2000);
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }
    void load();
    return () => {
      cancelled = true;
      clearTimeout(refresh);
    };
  }, [projectId, revision]);

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
        title="Couldn't load audits"
        description="It may not exist, or you may not have access to it."
      />
    );
  }

  const site = overview.sites[0];
  const crawls = site?.recentCrawls ?? [];
  // Comparable = a COMPLETED crawl with a score, and at least one earlier COMPLETED-with-score
  // crawl exists before it (crawls are ordered newest-first, so "before it" is anything after it
  // in this array).
  const comparableIds = new Set(
    crawls
      .filter(
        (crawl, index) =>
          crawl.status === "COMPLETED" &&
          crawl.overallScore !== null &&
          crawls
            .slice(index + 1)
            .some((earlier) => earlier.status === "COMPLETED" && earlier.overallScore !== null),
      )
      .map((crawl) => crawl.id),
  );

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-steel-100">Audits</h1>
          <p className="text-sm text-steel-400">
            Every crawl of this site and its Search Health score.
          </p>
        </div>
        {desktop && site && (
          <Button
            onClick={() => void changeCrawl(site.id)}
            isLoading={action === "start"}
            disabled={Boolean(action) || crawls.some((crawl) => activeStatuses.has(crawl.status))}
          >
            Run crawl
          </Button>
        )}
      </header>
      {actionError && (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      )}

      {crawls.length === 0 ? (
        <StatusState
          kind="empty"
          title="No crawls yet"
          description="Run a crawl to see audit history here."
        />
      ) : (
        <div className="space-y-2">
          {crawls.map((crawl) => (
            <div
              key={crawl.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded border border-forge-800 px-4 py-3"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="text-sm font-medium text-steel-100">
                  {crawl.finishedAt
                    ? formatRelativeTime(crawl.finishedAt)
                    : formatRelativeTime(crawl.createdAt)}
                </p>
                <p className="text-xs text-steel-500">{crawl.pagesCrawled} pages crawled</p>
                {desktop && crawl.errorMessage && (
                  <p className="mt-1 break-words text-xs text-danger">{crawl.errorMessage}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <Badge tone={statusTone(crawl.status)}>{crawl.status}</Badge>
                {desktop && crawl.auditStatus === "FAILED" && (
                  <Badge tone="danger">Audit failed</Badge>
                )}
                {desktop && crawl.status === "COMPLETED" && !crawl.auditStatus && (
                  <Badge tone="neutral">Awaiting analysis</Badge>
                )}
                {desktop && site && activeStatuses.has(crawl.status) && (
                  <Button
                    variant="secondary"
                    onClick={() => void changeCrawl(site.id, crawl.id)}
                    disabled={Boolean(action)}
                    isLoading={action === crawl.id}
                  >
                    Cancel
                  </Button>
                )}
                {crawl.overallScore !== null ? (
                  <Badge tone={scoreTone(crawl.overallScore)}>Score {crawl.overallScore}</Badge>
                ) : null}
                {comparableIds.has(crawl.id) ? (
                  <Link
                    href={`/app/projects/${projectId}/audits/${crawl.id}/compare`}
                    className="rounded border border-forge-700 px-3 py-1 text-xs font-medium text-steel-300 hover:border-steel-500 hover:text-steel-100"
                  >
                    Compare to previous
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
