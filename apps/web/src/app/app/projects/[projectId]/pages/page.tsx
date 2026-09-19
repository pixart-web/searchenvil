"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Input, Spinner, StatusState } from "@searchenvil/ui";
import { apiFetch } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import type { CrawlPageListItem, PagedResult } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

function statusTone(statusCode: number | null): "success" | "warning" | "danger" | "neutral" {
  if (statusCode === null) return "neutral";
  if (statusCode >= 200 && statusCode < 300) return "success";
  if (statusCode >= 300 && statusCode < 400) return "warning";
  if (statusCode >= 400) return "danger";
  return "neutral";
}

export default function PagesListPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}): React.ReactElement {
  const { projectId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [result, setResult] = useState<PagedResult<CrawlPageListItem> | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const params = new URLSearchParams({ page: String(page) });
        if (search) params.set("search", search);

        const data = await resolveProjectOrg(projectId, (orgId) =>
          apiFetch<PagedResult<CrawlPageListItem>>(
            `/organizations/${orgId}/projects/${projectId}/pages?${params.toString()}`,
          ),
        );
        if (!cancelled) {
          setResult(data);
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
  }, [projectId, search, page]);

  if (state === "loading" && !result) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (state === "error" || !result) {
    return (
      <StatusState
        kind="error"
        title="Couldn't load pages"
        description="It may not exist, or you may not have access to it."
      />
    );
  }

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-steel-100">Pages</h1>

      <Input
        aria-label="Search pages by URL"
        placeholder="Search by URL…"
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        className="max-w-xs"
      />

      {result.items.length === 0 ? (
        <StatusState
          kind="empty"
          title="No pages found"
          description={search ? "Try a different search." : "Run a crawl to see pages here."}
        />
      ) : (
        <>
          <div className="space-y-2">
            {result.items.map((crawlPage) => (
              <Link
                key={crawlPage.id}
                href={`/app/projects/${projectId}/pages/${crawlPage.id}`}
                className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded border border-forge-800 px-4 py-3 hover:border-steel-500"
              >
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium text-steel-100">
                    {crawlPage.title ?? "(no title)"}
                  </p>
                  <p className="truncate text-xs text-steel-500">{crawlPage.normalizedUrl}</p>
                </div>
                <div className="flex items-center gap-2">
                  {!crawlPage.isIndexable ? <Badge tone="warning">NOINDEX</Badge> : null}
                  <Badge tone={statusTone(crawlPage.statusCode)}>{crawlPage.statusCode ?? "—"}</Badge>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between text-sm text-steel-400">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="disabled:opacity-40"
              >
                ← Previous
              </button>
              <span>
                Page {result.page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="disabled:opacity-40"
              >
                Next →
              </button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
