"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Input, Spinner, StatusState, type BadgeSeverity } from "@searchenvil/ui";
import { apiFetch } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import { formatCategoryLabel } from "@/lib/format";
import type { IssueCategory, IssueListItem, IssueSeverity } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

const SEVERITIES: IssueSeverity[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "NOTICE"];
const CATEGORIES: IssueCategory[] = [
  "TECHNICAL",
  "INDEXABILITY",
  "CONTENT",
  "INTERNAL_LINKING",
  "STRUCTURED_DATA",
];

export default function IssuesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): React.ReactElement {
  const { projectId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [issues, setIssues] = useState<IssueListItem[]>([]);
  const [severityFilter, setSeverityFilter] = useState<IssueSeverity | "">("");
  const [categoryFilter, setCategoryFilter] = useState<IssueCategory | "">("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const params = new URLSearchParams();
        if (severityFilter) params.set("severity", severityFilter);
        if (categoryFilter) params.set("category", categoryFilter);
        if (search) params.set("search", search);
        const query = params.toString() ? `?${params.toString()}` : "";

        const data = await resolveProjectOrg(projectId, (id) =>
          apiFetch<IssueListItem[]>(`/organizations/${id}/projects/${projectId}/issues${query}`),
        );
        if (!cancelled) {
          setIssues(data);
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
  }, [projectId, severityFilter, categoryFilter, search]);

  if (state === "loading" && issues.length === 0) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (state === "error") {
    return (
      <StatusState
        kind="error"
        title="Couldn't load issues"
        description="It may not exist, or you may not have access to it."
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-steel-100">Issues</h1>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search issues…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as IssueSeverity | "")}
          className="h-10 rounded border border-forge-800 bg-forge-900 px-3 text-sm text-steel-100"
        >
          <option value="">All severities</option>
          {SEVERITIES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as IssueCategory | "")}
          className="h-10 rounded border border-forge-800 bg-forge-900 px-3 text-sm text-steel-100"
        >
          <option value="">All categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {formatCategoryLabel(c)}
            </option>
          ))}
        </select>
      </div>

      {issues.length === 0 ? (
        <StatusState
          kind="empty"
          title="No issues match these filters"
          description={
            severityFilter || categoryFilter || search
              ? "Try clearing a filter."
              : "No issues found on the latest audit — nice work."
          }
        />
      ) : (
        <div className="space-y-2">
          {issues.map((issue) => (
            <Link
              key={issue.id}
              href={`/app/projects/${projectId}/issues/${issue.id}`}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded border border-forge-800 px-4 py-3 hover:border-steel-500"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium text-steel-100">{issue.title}</p>
                <p className="text-xs text-steel-500">
                  {formatCategoryLabel(issue.rule.category)} · {issue.affectedPageCount} affected
                  page{issue.affectedPageCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge severity={issue.severity.toLowerCase() as BadgeSeverity}>{issue.severity}</Badge>
                <Badge tone={issue.impact === "HIGH" ? "danger" : issue.impact === "MEDIUM" ? "warning" : "neutral"}>
                  {issue.impact} IMPACT
                </Badge>
                <Badge tone="neutral">{issue.effort}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
