# Product

**SearchEnvil — Forge Better Search Performance.**

## The five questions

SearchEnvil exists to answer, for a given website:

1. How healthy is my website?
2. What is wrong?
3. What should I fix first?
4. Which pages are affected?
5. Did the website improve since the previous audit?

Every feature in the initial release should serve one of these. SearchEnvil is deliberately
**not** attempting to be a SEMrush-style all-in-one marketing suite (see Out of scope below).

## The core loop

```
PROJECT → WEBSITE → CRAWL → FACTS → AUDIT → SEARCH HEALTH → FORGE PRIORITIES → FIXES → RECRAWL → COMPARISON
```

## Core concepts

### Search Health

A versioned 0–100 score representing overall technical search health. It is **not** simply "% of
checks passed" — it weighs severity, impact, confidence, affected-page count, rule weight, and
category. Every score is stored with enough context (`AuditScore.explanation`,
`AuditScore.scoringVersion`) to explain it later even if the scoring algorithm changes. See
[SCORING.md](./SCORING.md) for the methodology (implemented in Phase 08).

Categories: Technical, Indexability, Content, Performance, Internal Linking, Structured Data.

### Forge Priorities

Issues are ranked, not just listed. Each actionable issue carries severity, impact, effort,
affected-page count, an explanation, and a recommended fix — e.g. "Broken internal links — HIGH
IMPACT, EASY, 9 affected pages." SearchEnvil does not invent unsupported traffic or revenue
claims. See [AUDIT_ENGINE.md](./AUDIT_ENGINE.md).

### Crawl Comparison

Users can see what changed between two crawls of the same site: Search Health before/after,
fixed/new/persistent issues, and improved/worsened pages — all derived from deterministic stored
data, never a generated narrative guess. Implemented in Phase 13.

## Out of scope for this release

Deliberately excluded unless technically required for the loop above: a global keyword database,
backlink index, mass SERP scraping, PPC/social/CRM/marketplace tooling, native mobile apps, full
agency white-labeling, a generative AI SEO assistant, Google Search Console/Analytics
integration, a WordPress plugin, a public API product, complex billing, and an affiliate system.
See [BACKLOG.md](../BACKLOG.md) for anything deferred rather than rejected.
