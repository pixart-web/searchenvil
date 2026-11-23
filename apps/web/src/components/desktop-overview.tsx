import Link from "next/link";
import { formatCategoryLabel, formatRelativeTime } from "@/lib/format";
import type { SiteOverview } from "@/lib/types";

const severity = [
  ["CRITICAL", "Critical", "critical"],
  ["HIGH", "High", "high"],
  ["MEDIUM", "Medium", "medium"],
  ["LOW", "Low", "low"],
  ["NOTICE", "Notice", "neutral"],
] as const;

function healthBand(score: number): string {
  if (score >= 90) return "low";
  if (score >= 70) return "medium";
  return "critical";
}

export function DesktopOverview({
  projectId,
  projectName,
  site,
}: {
  projectId: string;
  projectName: string;
  site: SiteOverview;
}): React.ReactElement {
  const base = `/app/projects/${projectId}`;
  const audit = site.latestCrawl;
  const latest = site.recentCrawls[0];
  const categories = audit ? Object.entries(audit.score.categoryScores) : [];
  const issueCount = Object.values(audit?.issuesBySeverity ?? {}).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <div className="operations">
      <header className="operations-heading">
        <div>
          <h1>{projectName}</h1>
        </div>
        <Link className="operations-action" href={base + "/audits"}>
          Open audits <span aria-hidden="true">↗</span>
        </Link>
      </header>

      <section className="operations-panel" aria-labelledby="site-summary">
        <div className="operations-panel-head">
          <h2 id="site-summary">Site diagnostics</h2>
          <span>
            {audit?.finishedAt
              ? `Audited ${formatRelativeTime(audit.finishedAt)}`
              : "Awaiting first audit"}
          </span>
        </div>
        <dl className="operations-metrics">
          <div data-signal={audit ? healthBand(audit.score.overallScore) : "neutral"}>
            <dt>Search Health</dt>
            <dd>
              {audit ? (
                <>
                  {audit.score.overallScore}
                  <small> / 100</small>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt>Pages crawled</dt>
            <dd>{audit?.pagesCrawled ?? "—"}</dd>
          </div>
          {severity.map(([key, label, tone]) => (
            <div key={key} data-signal={tone}>
              <dt>{label}</dt>
              <dd>{audit ? (audit.issuesBySeverity[key] ?? 0) : "—"}</dd>
            </div>
          ))}
          <div>
            <dt>Total issues</dt>
            <dd>{audit ? issueCount : "—"}</dd>
          </div>
        </dl>
      </section>

      <section className="operations-panel" aria-labelledby="category-matrix">
        <div className="operations-panel-head">
          <h2 id="category-matrix">Technical health matrix</h2>
          <Link href={base + "/issues"}>
            Inspect findings <span aria-hidden="true">→</span>
          </Link>
        </div>
        {categories.length ? (
          <div className="operations-matrix" role="list">
            {categories.map(([category, score]) => (
              <div
                key={category}
                role="listitem"
                className="operations-category"
                data-signal={healthBand(score)}
              >
                <h3>{formatCategoryLabel(category)}</h3>
                <dl>
                  <div>
                    <dt>Health score</dt>
                    <dd>{score}</dd>
                  </div>
                  <div>
                    <dt>Findings</dt>
                    <dd>{audit?.issuesByCategory[category] ?? 0}</dd>
                  </div>
                </dl>
                <meter
                  min={0}
                  max={100}
                  value={score}
                  aria-label={formatCategoryLabel(category) + " health score"}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="operations-empty">Category scores appear after the first audit finishes.</p>
        )}
      </section>

      <div className="operations-details">
        <section className="operations-panel" aria-labelledby="forge-priorities">
          <div className="operations-panel-head">
            <h2 id="forge-priorities">Forge Priorities</h2>
            <Link href={base + "/issues"}>
              All issues <span aria-hidden="true">→</span>
            </Link>
          </div>
          {audit?.topIssues.length ? (
            <ul className="operations-list">
              {audit.topIssues.map((issue) => (
                <li key={issue.id}>
                  <Link
                    href={base + "/issues/" + issue.id}
                    data-signal={issue.severity.toLowerCase()}
                  >
                    <span>
                      <span className="operations-rule">{issue.ruleKey}</span>
                      <strong>{issue.title}</strong>
                    </span>
                    <span className="operations-count">
                      {issue.affectedPageCount} {issue.affectedPageCount === 1 ? "page" : "pages"}
                    </span>
                    <span className="operations-severity">{issue.severity}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="operations-empty">
              {audit
                ? "No issues found in this audit."
                : "Priorities appear when audit results are available."}
            </p>
          )}
        </section>

        <section className="operations-panel" aria-labelledby="crawl-activity">
          <div className="operations-panel-head">
            <h2 id="crawl-activity">Crawl activity</h2>
            {latest && <span>{latest.status.replaceAll("_", " ")}</span>}
          </div>
          {site.recentCrawls.length ? (
            <ol className="operations-history">
              {site.recentCrawls.map((crawl) => (
                <li key={crawl.id}>
                  <span>{formatRelativeTime(crawl.finishedAt ?? crawl.createdAt)}</span>
                  <strong>{crawl.status}</strong>
                  <span>{crawl.overallScore ?? "—"}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="operations-empty">No crawl activity yet.</p>
          )}
        </section>
      </div>
    </div>
  );
}
