"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { Badge, Card, CardContent, CardHeader, CardTitle, Spinner, StatusState, type BadgeSeverity } from "@searchenvil/ui";
import { apiFetch } from "@/lib/api-client";
import { resolveProjectOrg } from "@/lib/resolve-project-org";
import type { CrawlPageDetail } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

function Field({ label, value }: { label: string; value: React.ReactNode }): React.ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 py-1.5 text-sm">
      <span className="text-steel-500">{label}</span>
      <span className="min-w-0 max-w-[70%] break-words text-right text-steel-200">{value}</span>
    </div>
  );
}

export default function PageDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; pageId: string }>;
}): React.ReactElement {
  const { projectId, pageId } = use(params);
  const [state, setState] = useState<LoadState>("loading");
  const [page, setPage] = useState<CrawlPageDetail | undefined>();

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        const data = await resolveProjectOrg(projectId, (orgId) =>
          apiFetch<CrawlPageDetail>(`/organizations/${orgId}/projects/${projectId}/pages/${pageId}`),
        );
        if (!cancelled) {
          setPage(data);
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
  }, [projectId, pageId]);

  if (state === "loading") {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  if (state === "error" || !page) {
    return (
      <StatusState
        kind="error"
        title="Couldn't load this page"
        description="It may not exist, or you may not have access to it."
      />
    );
  }

  const missingAltCount = page.images.filter((img) => !img.hasAlt).length;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/app/projects/${projectId}/pages`} className="text-xs text-steel-500 hover:text-steel-300">
          ← Back to Pages
        </Link>
        <h1 className="mt-2 break-all text-lg font-semibold text-steel-100">{page.normalizedUrl}</h1>
        {page.title ? <p className="text-sm text-steel-400">{page.title}</p> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>HTTP</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Status" value={page.statusCode ?? "—"} />
            <Field label="Final URL" value={page.finalUrl} />
            <Field
              label="Redirect hops"
              value={page.redirectChain?.length ? page.redirectChain.length : "None"}
            />
            <Field label="Response time" value={page.responseTimeMs ? `${page.responseTimeMs}ms` : "—"} />
            <Field label="HTML size" value={page.htmlSizeBytes ? `${Math.round(page.htmlSizeBytes / 1024)} KB` : "—"} />
            {page.fetchError ? <Field label="Fetch error" value={page.fetchError} /> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Indexability</CardTitle>
          </CardHeader>
          <CardContent>
            <Field
              label="Indexable"
              value={<Badge tone={page.isIndexable ? "success" : "warning"}>{page.isIndexable ? "Yes" : "No"}</Badge>}
            />
            <Field label="Meta robots" value={page.metaRobots ?? "—"} />
            <Field label="X-Robots-Tag" value={page.xRobotsTag ?? "—"} />
            <Field label="Canonical" value={page.canonicalUrl ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Title" value={page.title ?? "—"} />
            <Field label="Meta description" value={page.metaDescription ?? "—"} />
            <Field label="Language" value={page.language ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Word count" value={page.wordCount ?? "—"} />
            <Field label="Headings" value={page.headings?.length ?? 0} />
            <Field label="H1" value={page.h1 ?? "—"} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Links</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Outbound links" value={page.outboundLinks.length} />
            <Field label="Inbound links (this crawl)" value={page.inboundLinkCount} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Images &amp; structured data</CardTitle>
          </CardHeader>
          <CardContent>
            <Field label="Images" value={page.images.length} />
            <Field label="Missing alt text" value={missingAltCount} />
            <Field label="Structured data blocks" value={page.structuredData.length} />
            <Field
              label="Invalid structured data"
              value={page.structuredData.filter((sd) => !sd.isValid).length}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issues affecting this page ({page.issues.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {page.issues.length === 0 ? (
            <p className="text-sm text-steel-400">No issues found on this page.</p>
          ) : (
            <div className="space-y-2">
              {page.issues.map((issue) => (
                <Link
                  key={issue.id}
                  href={`/app/projects/${projectId}/issues/${issue.id}`}
                  className="flex items-center justify-between gap-3 rounded border border-forge-800 px-3 py-2 hover:border-steel-500"
                >
                  <span className="text-sm text-steel-100">{issue.title}</span>
                  <Badge severity={issue.severity.toLowerCase() as BadgeSeverity}>{issue.severity}</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
