# Phase 07 — Audit Engine

**Status: COMPLETE — gate passed.**

## Scope implemented

- **Rule contract & registry** (`packages/audit-engine`): `AuditRuleDefinition` (key, version,
  category, severity, effort, weight, description/whyItMatters/recommendation, `evaluate`),
  `runAudit()` orchestrator, a registry with duplicate-key and non-empty-copy sanity checks
  enforced at module load.
- **28 rules** across all 5 applicable categories (Technical, Indexability, Content, Internal
  Linking, Structured Data — Performance is Phase 12's domain) — see `docs/AUDIT_ENGINE.md` for
  the full inventory. Rules are graded by how certain the finding actually is: deterministic
  defects (broken links, malformed structured data, server errors) get real severities; contextual
  findings (noindex, missing canonical, thin content) get `NOTICE`/`LOW` and are phrased as
  prompts to review, not verdicts — per section 10 of the build spec.
- **Worker integration** (`apps/worker/src/audit`): maps persisted `CrawlPage` rows into the
  engine's `SiteInput`, syncs the code rule registry into the `AuditRule` table, runs the audit,
  persists `AuditRun` → `AuditIssue` → `AuditOccurrence`. Triggered automatically the moment a
  crawl reaches `COMPLETED` via a new `AUDIT` BullMQ queue (never on `FAILED`/`CANCELLED`).
- **Schema fix**: `Crawl.sitemapUrls`/`robotsTxtFound` — Phase 06 never persisted these (nothing
  needed them yet), but three audit rules do. Added via migration
  `20260919185434_add_crawl_sitemap_fields` and wired into `process-crawl-job.ts`'s completion
  step.

## Key files

- `packages/audit-engine/src/rules/{technical,indexability,content,internal-linking,structured-data}.ts`
- `packages/audit-engine/src/{types,rule-helpers,rule-registry,run-audit}.ts`
- `packages/audit-engine/src/fixtures/page-builder.ts`
- `apps/worker/src/audit/{map-crawl-to-site-input,sync-audit-rules,process-audit-job,placeholder-priority}.ts`

## Tests added

- 71 rule-level unit tests (one file per category, positive + negative + edge cases per rule) —
  e.g. `duplicate-title` fires on exactly the pages sharing a title, `missing-h1` ignores non-200
  pages, `orphan-page` never flags the crawl's own start page, `broken-internal-link` ignores
  external links.
- `rule-registry.spec.ts` (7) — rule count within the spec's 25–35 target range, no duplicate
  keys, every rule has non-empty description/whyItMatters/recommendation, every category is
  covered.
- `run-audit.spec.ts` (4) — **the Phase 07 gate**: a 4-page fixture site with specific, deliberately
  planted defects (a 404 link, a duplicate title, a missing H1, a missing alt attribute, an orphan
  page, no sitemap) asserts the exact expected issues fire on the exact expected pages, and that
  unrelated rules (5xx, non-HTTPS, mixed content, invalid structured data, conflicting
  indexability) correctly do *not* fire; a companion test confirms a fully clean fixture produces
  zero issues.
- `apps/worker/src/audit/process-audit-job.spec.ts` (4, real Postgres) — creates the right
  `AuditRun`/`AuditIssue`/`AuditOccurrence` rows for a fixture with known defects, zero issues for
  a clean site, `FAILED` status with the error captured when site-input loading throws, and
  idempotent re-run behavior (doesn't duplicate an existing completed run).
- Workspace total: 78 (audit-engine) + 13 (worker, up from 9) = new tests this phase; grand total
  across the workspace is now 185 unit/integration + 31 e2e = 216 automated tests.

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

## Manual end-to-end proof (Phase 07 gate: "known fixtures produce expected findings")

Beyond the automated fixture tests, ran the real API + worker together and triggered a real crawl
+ audit of `https://example.com`:

```json
{
  "status": "COMPLETED",
  "issues": [
    { "rule": "sitemap-not-found", "severity": "LOW" },
    { "rule": "missing-canonical", "severity": "NOTICE" },
    { "rule": "title-suspicious-length", "severity": "LOW", "evidence": { "title": "Example Domain", "length": 14 } },
    { "rule": "missing-meta-description", "severity": "MEDIUM" },
    { "rule": "low-word-count", "severity": "NOTICE", "evidence": { "wordCount": 19 } }
  ]
}
```

Every finding is independently verifiable as accurate for that real page: `example.com` genuinely
has no sitemap, no canonical tag, a 14-character title (correctly under the 15-character
threshold), no meta description, and 19 words of body text. This is the strongest form of proof —
not "the code matches what a fixture was designed to produce," but "the code correctly interprets
facts from a page it had never seen before."

## Architecture decisions

No new ADRs — this phase applies the "package interprets facts, doesn't fetch them" boundary
established in ADR-001/Phase 01 to a second package, and reuses the injectable-dependency testing
pattern from ADR-007/Phase 06 (`buildSiteInput` in `processAuditJob`).

## Bugs found during self-audit and fixes made

- The first `run-audit.spec.ts` draft asserted `missing-title` should fire on a 404 page with no
  title — wrong: the rule correctly excludes non-200 pages (a 404 page not having a meaningful
  title isn't a separate defect worth reporting), so the assertion, not the rule, was fixed.
- `page-builder.ts`'s default fixture title (`"Page N Title"`) was short enough to accidentally
  trip `title-suspicious-length` in unrelated tests that didn't override it, including the "clean
  fixture produces zero issues" test. Lengthened the default to a safely mid-range string so
  fixtures are clean by default unless a test deliberately overrides a field to be unclean.
- `process-audit-job.spec.ts`'s first draft used a fabricated page id (`"home"`) in an in-memory
  `SiteInput` without a corresponding real `CrawlPage` row, which failed with a foreign-key
  violation on `AuditOccurrence.pageId` — correctly, since occurrences must reference a real
  persisted page. Fixed the test to seed a real `CrawlPage` row and use its actual id, which is a
  more accurate test anyway (production `SiteInput`s always come from real rows via
  `mapCrawlToSiteInput`).
- Prisma's `Json` input typing rejected occurrence `evidence` (a `Record<string, unknown>`) in
  `createMany` the same way it rejected `HeadingFact[]`/`OpenGraphFact[]` in Phase 06 — same fix,
  cast at the call site (`as object`).

## Known limitations / technical debt

Documented in full in `docs/AUDIT_ENGINE.md` ("What's deliberately not covered yet"): no true
duplicate-content detection (would need a content hash the crawler doesn't compute — a real
future capability, not silently dropped), no standalone `blocked-by-robots` rule (the crawler
already refuses those pages), and `AuditIssue.priorityScore`/`impact` are a deliberately simple
placeholder pending Phase 08's real scoring methodology.

## Security considerations

No new attack surface — the audit engine only reads already-persisted, already-validated crawl
data and writes structured findings; it makes no network calls and has no user-facing input
surface of its own (issue viewing/filtering endpoints land with the Phase 10 Issues UI).

## Readiness for next phase

Gate met: known fixtures (both hand-built and a real, previously-unseen page) produce exactly the
expected findings. Proceeding to Phase 08 (Search Health & Forge Priorities) — the real scoring
and prioritization methodology that replaces this phase's placeholder.
