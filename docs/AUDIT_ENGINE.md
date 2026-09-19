# Audit Engine

`@searchenvil/audit-engine` interprets facts into findings. It never fetches anything, never
touches the network, and never talks to Postgres directly — see `docs/ARCHITECTURE.md` ("Crawler
≠ Audit Engine"). If a rule needs to know something not already in `SiteInput`, that's a signal
the crawler or the worker's mapping layer needs to grow, not that the audit engine should reach
out and get it itself.

## Contract

```ts
interface AuditRuleDefinition {
  key: string;              // stable, e.g. "missing-title" — never reuse a retired key
  version: number;          // bump when evaluate() logic changes meaningfully
  name: string;
  category: IssueCategory;  // TECHNICAL | INDEXABILITY | CONTENT | INTERNAL_LINKING | STRUCTURED_DATA
  defaultSeverity: IssueSeverity;   // CRITICAL | HIGH | MEDIUM | LOW | NOTICE
  defaultEffort: EffortLevel;       // EASY | MEDIUM | HARD
  weight: number;           // relative importance for Search Health scoring (Phase 08)
  description: string;
  whyItMatters: string;
  recommendation: string;
  evaluate: (site: SiteInput) => Occurrence[];
}
```

`runAudit(site, rules)` runs every rule and groups each one's hits into an `AuditIssueResult`
(one per rule that actually fired, with N `Occurrence`s) — a rule that finds nothing produces no
result at all, never an empty issue.

`SiteInput`/`PageInput` are the audit engine's own types, not a re-export of Prisma models. The
worker's `apps/worker/src/audit/map-crawl-to-site-input.ts` is the one place that bridges
"persisted `CrawlPage` rows" and "what a rule needs to see."

## Rule inventory (28 rules)

| Category | Rules |
|---|---|
| TECHNICAL (9) | `http-5xx-error`, `http-4xx-error`, `redirect-chain-too-long`, `missing-h1`, `multiple-h1`, `non-https-page`, `mixed-content`, `sitemap-not-found`, `sitemap-url-error` |
| INDEXABILITY (6) | `page-noindexed`, `conflicting-indexability-signals`, `missing-canonical`, `invalid-canonical-url`, `canonical-points-to-non-200`, `sitemap-contains-non-indexable-url` |
| CONTENT (9) | `missing-title`, `duplicate-title`, `title-suspicious-length`, `missing-meta-description`, `duplicate-meta-description`, `meta-description-suspicious-length`, `low-word-count`, `duplicate-h1`, `missing-alt-text` |
| INTERNAL_LINKING (3) | `broken-internal-link`, `internal-link-to-redirect`, `orphan-page` |
| STRUCTURED_DATA (1) | `invalid-structured-data` |

Source of truth: `packages/audit-engine/src/rules/*.ts`, one file per category. Every rule ships
with its own `description`/`whyItMatters`/`recommendation` text — that's what the product surfaces
to users (Forge Priorities, issue detail), not a generic template.

### Deterministic vs. contextual

Per section 10 of the build spec ("avoid presenting subjective SEO opinions as deterministic
errors"), rules are severity-graded to reflect how certain the finding actually is:

- **Deterministic, high-confidence**: `http-5xx-error`, `http-4xx-error`, `broken-internal-link`,
  `invalid-structured-data`, `invalid-canonical-url` — these are unambiguously defects.
- **Contextual, needs human judgment**: `page-noindexed` (often intentional — staging/thank-you
  pages), `missing-canonical` (not every page needs one), `low-word-count` (some pages are
  legitimately short), `multiple-h1` (some design systems use several intentionally). These are
  `NOTICE`/`LOW` severity and phrased as prompts to review, not verdicts.

## What's deliberately not covered yet

- **True duplicate-content detection** — would need a content hash the crawler doesn't currently
  compute (title/word-count matching alone would be too crude and misleading to ship as a "content
  is duplicated" claim). Tracked in `docs/BACKLOG.md` if it's picked up before the crawler needs
  another pass anyway.
- **`blocked-by-robots` as its own rule** — the crawler already refuses to fetch robots-disallowed
  pages (Phase 05), so there's no page row to attach a finding to without extra bookkeeping the
  crawler doesn't do today.
- **Real prioritization/scoring** — `AuditIssue.priorityScore`/`impact` are written by a
  deliberately simple placeholder (`apps/worker/src/audit/placeholder-priority.ts`) right now.
  Phase 08 ("Search Health & Forge Priorities") replaces it with the documented methodology
  without changing anything about how rules themselves work.

## Worker integration

`apps/worker/src/audit`:

- `map-crawl-to-site-input.ts` — reads persisted `CrawlPage` (+images, structured data, outbound
  links) and the `Crawl.sitemapUrls`/`robotsTxtFound` columns (added this phase — Phase 06 hadn't
  persisted them, since nothing needed them yet) into a `SiteInput`.
- `sync-audit-rules.ts` — upserts every rule in the code registry into the `AuditRule` table
  (keyed by `ruleKey`), so `AuditIssue.ruleId` always resolves. The registry in code is the source
  of truth; the DB row is a queryable mirror of it.
- `process-audit-job.ts` — creates an `AuditRun`, runs the engine, writes `AuditIssue` +
  `AuditOccurrence` rows, marks the run `COMPLETED`/`FAILED`. Re-running against a crawl that
  already has a non-`FAILED` `AuditRun` is a no-op (idempotent trigger).
- Triggered automatically: `process-crawl-job.ts` enqueues an audit job the moment a crawl reaches
  `COMPLETED` (never on `FAILED`/`CANCELLED`) via a new `AUDIT` BullMQ queue.

## Testing

Rule-level tests live next to each rule file (`rules/*.spec.ts`) — one deterministic
positive/negative fixture per rule, built with `fixtures/page-builder.ts`'s `buildPage()`/
`buildSite()` helpers. `run-audit.spec.ts` is the Phase 07 gate test proper: a small multi-page
fixture site with specific, deliberately planted defects, asserting the exact set of issues (and
only those) fire on the exact pages they should. `docs/progress/PHASE-07.md` also records a live
run against `https://example.com` as an additional real-world proof.
