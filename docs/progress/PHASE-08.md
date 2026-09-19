# Phase 08 — Search Health & Forge Priorities

**Status: COMPLETE — gate passed.**

## Scope implemented

- **`confidence` added to the rule contract**: every one of the 28 rules from Phase 07 now
  declares how certain a firing actually indicates a problem (0–1) — deterministic defects (a
  404, malformed JSON, a broken link) are 1.0; contextual findings that are often intentional
  (`page-noindexed`: 0.3, `low-word-count`: 0.4, `missing-canonical`: 0.4, `multiple-h1`: 0.5) are
  meaningfully lower, so they can never drag a score down as hard as a real defect of nominally
  similar severity.
- **`computeSearchHealth()`** (`packages/audit-engine/src/scoring.ts`): a documented penalty
  formula — `severityBase × confidence × (weight/10) × affectedRatio` per issue, categories start
  at 100 and lose points, floored at 0; overall score is the unweighted mean of the 5 currently-
  scored categories (`PERFORMANCE` excluded until Phase 12 has rules, not silently treated as
  clean). Every score carries a `scoringVersion` and a full per-issue penalty `explanation`, so a
  historical score stays explainable even after the formula changes later.
- **`prioritizeIssues()`** (`packages/audit-engine/src/priority.ts`): Forge Priorities — the same
  penalty, scaled by an effort ease-factor (EASY fixes rank above HARD ones of similar impact),
  with a total, deterministic tie-break by rule key. `impact` (HIGH/MEDIUM/LOW) is derived from
  the same penalty magnitude the ranking uses, so the badge and the order never disagree.
- **Worker integration**: `process-audit-job.ts` now computes real scores/priorities and persists
  them — `AuditScore` (one per `AuditRun`, upserted) and `AuditIssue.severity`/`impact`/
  `priorityScore` all come from `@searchenvil/audit-engine`, replacing Phase 07's placeholder
  (`placeholder-priority.ts`, deleted this phase).
- **API**: three new read endpoints — `GET .../crawls/:crawlId/score`, `.../issues`,
  `.../issues/:issueId` — the first surface for Forge Priorities/Search Health, ahead of the
  Phase 09 dashboard that will render them.

## Key files

- `packages/audit-engine/src/{scoring,priority}.ts`
- `packages/audit-engine/src/types.ts` (added `confidence`, `ImpactLabel`)
- `apps/worker/src/audit/process-audit-job.ts` (rewritten to use real scoring)
- `apps/api/src/crawls/{crawls.service,crawls.controller}.ts` (score/issues endpoints)

## Tests added

- `scoring.spec.ts` (7) — **the Phase 08 gate**: a clean site scores 100 across every category; the
  exact same input produces the exact same score every time (computed twice, asserted equal); a
  CRITICAL issue affecting every page scores worse than the same issue affecting one of many; a
  category never drops below 0; the explanation is stamped with the current scoring version and
  contains enough detail to reconstruct the score; a low-confidence contextual rule penalizes less
  than an equally-severe high-confidence one; `PERFORMANCE` is excluded from computed categories.
- `priority.spec.ts` (6) — a CRITICAL/high-confidence issue outranks a LOW/low-confidence one; the
  exact same input produces the exact same ranking every time; the ranking is stable regardless of
  input array order (proving the tie-break is real, not accidental object order); an EASY fix's
  ease-factor is distinguishably applied; impact labels are consistent with penalty magnitude; a
  clean site produces an empty ranking.
- `apps/worker/src/audit/process-audit-job.spec.ts` — extended with real `AuditScore` assertions
  (severity/priority/impact on `AuditIssue`, `overallScore` bounds, category scores present,
  explanation shape) for both the defect fixture and the clean-site fixture (asserts exactly 100).
- `apps/api/test/crawls.e2e-spec.ts` — extended with a new test: `404`/`[]` before an audit run
  exists, then real score/issues data once one does (seeded directly via Prisma, the way the
  worker would leave it), plus tenant isolation on all three new endpoints.
- Workspace total: 91 (audit-engine, up from 78) + 13 (worker) = new coverage this phase; grand
  total across the workspace is now 199 unit/integration + 32 e2e = 231 automated tests.

## Commands executed and results

```
pnpm build / typecheck / lint / test / test:e2e (full workspace) → all green
```

## Manual end-to-end proof (Phase 08 gate: "same inputs always produce explainable expected scores/priorities")

Ran a fresh live crawl + audit of `https://example.com` through the real API and worker:

```json
{
  "overallScore": 99,
  "categoryScores": { "CONTENT": 95, "TECHNICAL": 100, "INDEXABILITY": 100, "STRUCTURED_DATA": 100, "INTERNAL_LINKING": 100 }
}
```

Every point lost is individually itemized in `explanation.issuePenalties` — e.g.
`missing-meta-description` (MEDIUM, confidence 0.85, weight 4) costs 4.08 of the 5-point CONTENT
deficit, while `low-word-count` (NOTICE, confidence 0.4) costs only 0.12 despite firing on the
same page — exactly the "high-confidence issues cost more than contextual ones" behavior the
formula is designed to produce. Forge Priorities correctly ranked `missing-meta-description`
first (`priorityScore` 4.90, well above the next-highest 0.72), matching intuition: it's the most
concrete, actionable defect on the page. This is the strongest form of the gate — not a
hand-picked fixture confirming the code does what it was written to do, but a real page's score
being fully traceable to real, itemized reasons.

## Architecture decisions

No new ADRs — this phase completes the scoring/prioritization design implied since Phase 01's
schema (`AuditScore.explanation`, `AuditIssue.priorityScore`) without introducing a new
architectural boundary.

## Bugs found during self-audit and fixes made

- None required a code fix this phase — the scoring/priority test suites (13 new tests) all
  passed on first implementation, and the live `example.com` proof matched hand-calculated
  expectations exactly. Worth noting as a contrast to Phases 05–07, where the live-verification
  step did catch real bugs — this phase's design (pure functions operating on already-tested
  `AuditIssueResult[]` input) had a smaller surface for integration-only bugs to hide in.

## Known limitations / technical debt

Documented in `docs/SCORING.md` ("What's intentionally out of scope"): category weighting is
currently unweighted/equal (no product signal yet that one category should count more by
default), and cross-crawl trend smoothing is Phase 13's job, not this one's.

## Security considerations

No new attack surface — the three new API endpoints reuse the existing `OrgRolesGuard`/
`MEMBER`-role pattern established for every other crawl-scoped resource, verified by the same
tenant-isolation test pattern used throughout.

## Readiness for next phase

Gate met: identical inputs produce identical, fully-explainable scores and priority rankings,
verified by both deterministic tests and a real, independently-checkable live audit. Proceeding
to Phase 09 (Overview Dashboard) — the first UI to actually render Search Health and Forge
Priorities for a real user.
