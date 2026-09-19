"use client";

import { use, useEffect, useState } from "react";
import { Badge, Spinner, StatusState } from "@searchenvil/ui";
import { apiFetch } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import type { ProjectPerformance } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

// Same Core Web Vitals thresholds as @searchenvil/audit-engine's performance
// rules (docs/PERFORMANCE.md) — kept in sync deliberately so a page never
// looks "fine" here while an issue about it exists elsewhere.
function lcpTone(ms: number | null): "success" | "warning" | "danger" | "neutral" {
  if (ms === null) return "neutral";
  if (ms > 4000) return "danger";
  if (ms > 2500) return "warning";
  return "success";
}

function clsTone(value: number | null): "success" | "warning" | "danger" | "neutral" {
  if (value === null) return "neutral";
  if (value > 0.25) return "danger";
  if (value > 0.1) return "warning";
  return "success";
}

function ttfbTone(ms: number | null): "success" | "warning" | "danger" | "neutral" {
  if (ms === null) return "neutral";
  if (ms > 800) return "danger";
  if (ms > 400) return "warning";
  return "success";
}

export default function PerformancePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): React.ReactElement {
  const { projectId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [data, setData] = useState<ProjectPerformance | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const result = await resolveProjectOrg(projectId, (orgId) =>
          apiFetch<ProjectPerformance>(`/organizations/${orgId}/projects/${projectId}/performance`),
        );
        if (!cancelled) {
          setData(result);
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

  if (state === "loading" && !data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (state === "error" || !data) {
    return (
      <StatusState
        kind="error"
        title="Couldn't load performance data"
        description="It may not exist, or you may not have access to it."
      />
    );
  }

  if (!data.crawlId) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-steel-100">Performance</h1>
        <StatusState kind="empty" title="No completed crawl yet" description="Run a crawl to see performance samples here." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-steel-100">Performance</h1>
        <p className="text-sm text-steel-400">
          {data.samples.length} of {data.totalPagesCrawled} crawled page
          {data.totalPagesCrawled === 1 ? "" : "s"} sampled with a real browser run. Performance
          analysis is intentionally bounded — see{" "}
          <span className="text-steel-300">docs/PERFORMANCE.md</span> for why.
        </p>
      </div>

      {data.samples.length === 0 ? (
        <StatusState
          kind="empty"
          title="No performance samples yet"
          description="Performance analysis runs automatically after a crawl completes."
        />
      ) : (
        <div className="space-y-2">
          {data.samples.map((sample) => (
            <div
              key={sample.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded border border-forge-800 px-4 py-3"
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium text-steel-100">
                  {sample.page.title ?? "(no title)"}
                </p>
                <p className="truncate text-xs text-steel-500">{sample.page.normalizedUrl}</p>
              </div>

              {sample.status === "FAILED" ? (
                <Badge tone="warning">Analysis failed{sample.errorMessage ? `: ${sample.errorMessage}` : ""}</Badge>
              ) : (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <Badge tone={ttfbTone(sample.ttfbMs)}>TTFB {sample.ttfbMs ?? "—"}ms</Badge>
                  <Badge tone={lcpTone(sample.lcpMs)}>LCP {sample.lcpMs ?? "—"}ms</Badge>
                  <Badge tone={clsTone(sample.cls)}>CLS {sample.cls ?? "—"}</Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
