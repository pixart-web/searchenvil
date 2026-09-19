# Scoring: Search Health & Forge Priorities

Implemented in `packages/audit-engine/src/{scoring,priority}.ts`. Both consume the same
`AuditIssueResult[]` that `runAudit()` produces (see `docs/AUDIT_ENGINE.md`) — scoring and
prioritization are two views of the same underlying computation, not two separate systems.

## Why not just "% of checks passed"

Per section 3 of the build spec, Search Health must not simply equal the pass rate. A site with
one broken checkout page and a site with a slightly-too-long meta description on one blog post
should not score the same just because both "have one issue." The methodology below weighs
**severity**, **confidence**, **rule weight**, and **how much of the site is actually affected** —
not just issue count.

## The penalty formula

For one issue (a rule that fired, with N occurrences):

```
penalty = severityBase(severity) × confidence × (weight / 10) × affectedRatio
```

| Term | Meaning | Source |
|---|---|---|
| `severityBase` | CRITICAL=40, HIGH=25, MEDIUM=12, LOW=5, NOTICE=1 | fixed, per severity |
| `confidence` | 0–1, how sure we are this is actually a problem | `AuditRuleDefinition.confidence` — see `docs/AUDIT_ENGINE.md` ("Deterministic vs. contextual") |
| `weight / 10` | the rule's configured relative importance, normalized around 1.0 | `AuditRuleDefinition.weight` |
| `affectedRatio` | `min(1, occurrences / totalPages)` | how much of the crawled site this touches |

A category starts at 100 points and loses each issue's penalty, floored at 0:

```
categoryScore = max(0, 100 - Σ penalty for issues in that category)
```

**Overall Search Health** is the unweighted mean of the category scores that are currently in
play: `TECHNICAL`, `INDEXABILITY`, `CONTENT`, `INTERNAL_LINKING`, `STRUCTURED_DATA` always, plus
`PERFORMANCE` once at least one page has actually been sampled (see "The PERFORMANCE category is
special" below) — never silently averaged in as if it were clean when there's simply no data yet.

### The PERFORMANCE category is special

Every other category's `affectedRatio` is computed against the full crawl (`occurrences /
totalPages`). PERFORMANCE can't use that denominator: performance analysis only ever samples a
small, bounded subset of pages (see `docs/PERFORMANCE.md`), so if the sample's own 5 pages were
divided by, say, 200 crawled pages, a real, universal performance problem would look like it barely
affects the site. `computeSearchHealth`/`prioritizeIssues` therefore take the whole `SiteInput` (not
just `totalPages`) and use a **per-category denominator**: `performanceSampleSize` (the count of
pages that actually have a `performance` fact) for `PERFORMANCE`, `totalPages` for everything else.

This is why the same defect affecting every page costs far more than it affecting one page out of
a hundred (`affectedRatio`), and why a contextual finding like "no canonical tag" can never drag
the score down as hard as a deterministic one like "500 error" of the same nominal severity
(`confidence`).

## Forge Priorities

Ranks issues by the same penalty (how many Search Health points fixing it would recover), scaled
by how easy the fix is:

```
priorityScore = penalty × easeFactor(effort)     // EASY=1.2, MEDIUM=1.0, HARD=0.8
```

This directly implements "what should I fix first?" — a high-penalty, easy fix outranks a
similarly-costly hard one. Ties break by rule key, so the ranking is a strict total order, never
ambiguous. `impact` (`HIGH`/`MEDIUM`/`LOW`, shown in the UI per the spec's "Broken internal links —
HIGH IMPACT, EASY" example) is derived from the same penalty magnitude
(`≥15 → HIGH`, `≥5 → MEDIUM`, else `LOW`), so the badge a user sees and the ranking underneath it
never disagree with each other.

## Determinism & explainability

Both functions are pure: identical `(issues, totalPages)` input always produces identical output
— no randomness, no external state, no wall-clock dependence. This is the Phase 08 gate
("same inputs always produce explainable expected scores/priorities"), verified in
`scoring.spec.ts`/`priority.spec.ts` by literally computing the same input twice and asserting
equality, alongside fixture-based tests of individual formula behaviors (a widely-affecting issue
scores worse than a narrow one, a low-confidence rule penalizes less than a high-confidence one of
equal severity, etc).

Every `AuditScore` row stores `scoringVersion` and a full `explanation` — the per-category
breakdown and per-issue penalty contributions that produced it — so a historical score stays
explainable even after the formula itself changes in a later `scoringVersion`. Nothing here
recomputes a past score with today's formula.

## What's intentionally out of scope for this release

- **Configurable category weighting** — the overall score is currently an unweighted mean across
  the 5 scored categories. Documented as a possible future refinement, not implemented, since
  there's no product signal yet that any category should count more than another by default.
- **Cross-crawl score smoothing/trends** — a single crawl's score is fully computed here; trend
  lines and "did we improve?" comparisons are Phase 13 (Crawl Comparison).
