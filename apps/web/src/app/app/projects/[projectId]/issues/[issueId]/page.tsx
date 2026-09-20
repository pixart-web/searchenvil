"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner, StatusState, type BadgeSeverity } from "@searchanvil/ui";
import { apiFetch } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import { formatCategoryLabel } from "@/lib/format";
import type { IssueDetail } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

export default function IssueDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; issueId: string }>;
}): React.ReactElement {
  const { projectId, issueId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [issue, setIssue] = useState<IssueDetail | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const data = await resolveProjectOrg(projectId, (orgId) =>
          apiFetch<IssueDetail>(`/organizations/${orgId}/projects/${projectId}/issues/${issueId}`),
        );
        if (!cancelled) {
          setIssue(data);
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
  }, [projectId, issueId]);

  if (state === "loading") {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (state === "error" || !issue) {
    return (
      <StatusState
        kind="error"
        title="Couldn't load this issue"
        description="It may not exist, or you may not have access to it."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/app/projects/${projectId}/issues`} className="text-xs text-steel-500 hover:text-steel-300">
          ← Back to Issues
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-steel-100">{issue.title}</h1>
          <Badge severity={issue.severity.toLowerCase() as BadgeSeverity}>{issue.severity}</Badge>
          <Badge tone={issue.impact === "HIGH" ? "danger" : issue.impact === "MEDIUM" ? "warning" : "neutral"}>
            {issue.impact} IMPACT
          </Badge>
          <Badge tone="neutral">{issue.effort}</Badge>
        </div>
        <p className="mt-1 text-sm text-steel-400">{formatCategoryLabel(issue.rule.category)}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>What was found</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-steel-300">{issue.summary}</CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Why it matters</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-steel-300">{issue.rule.whyItMatters}</CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>How to fix it</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-steel-300">{issue.rule.recommendation}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            Affected pages ({issue.occurrences.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {issue.occurrences.map((occurrence) => (
            <div key={occurrence.id} className="rounded border border-forge-800 p-3">
              <p className="break-all text-sm font-medium text-steel-100">{occurrence.page.normalizedUrl}</p>
              {occurrence.page.statusCode ? (
                <p className="text-xs text-steel-500">Status {occurrence.page.statusCode}</p>
              ) : null}
              {Object.keys(occurrence.evidence).length > 0 ? (
                <pre className="mt-2 overflow-x-auto rounded bg-forge-950 p-2 font-mono text-xs text-steel-400">
                  {JSON.stringify(occurrence.evidence, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
