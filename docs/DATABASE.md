# Database

PostgreSQL via Prisma. `packages/database/prisma/schema.prisma` is the single source of truth —
this document is an orientation map, not a duplicate of the schema; read the schema itself for
exact fields/types.

## Model groups

| Group | Models | Notes |
|---|---|---|
| Identity | `User`, `Session`, `PasswordResetToken` | See `docs/SECURITY.md` for how these are hashed/expired |
| Tenancy | `Organization`, `OrganizationMember` | See `docs/SECURITY.md` for authorization enforcement |
| Core loop | `Project`, `Site`, `Crawl` | `Project → Site → Crawl`, the spine of `docs/PRODUCT.md`'s core loop |
| Crawl facts | `CrawlPage`, `CrawlLink`, `CrawlImage`, `CrawlStructuredDataBlock`, `PagePerformance` | Facts only — see `docs/ARCHITECTURE.md` ("Crawler ≠ Audit Engine"); never a judgment |
| Audit | `AuditRule`, `AuditRun`, `AuditIssue`, `AuditOccurrence`, `AuditScore` | See `docs/AUDIT_ENGINE.md`/`docs/SCORING.md` |

Crawl Comparison (`docs/progress/PHASE-13.md`) and Reports (`docs/progress/PHASE-14.md`) are
deliberately **not** their own tables — both are computed on demand from `AuditScore`/`AuditIssue`
rows already persisted here, so there's nothing to keep in sync and no risk of a stored report
drifting from the data it claims to summarize.

## Migrations

Standard Prisma workflow: `pnpm --filter @searchanvil/database exec prisma migrate dev --name
<description>` locally (generates + applies a migration against the local dev database);
`prisma migrate deploy` in a real environment (applies committed migrations only, no generation,
no prompts — see `docs/DEPLOYMENT.md`). Every migration in
`packages/database/prisma/migrations/` has been applied to (and exercised against) the local dev
database throughout this build; none has been applied to a production database.

## Removed: `Report` and `UsageRecord`

Two models — `Report` (a `projectId`/`crawlId`/`fileUrl` row, presumably meant to persist a
generated report) and `UsageRecord` (a generic `organizationId`/`metric`/`value`/period row,
presumably meant for future billing/usage tracking) — were scaffolded early in the build but never
referenced by any application code; a Phase 20 audit found them as dead schema and removed them
(migration `remove_unused_report_and_usage_record_tables`). Worth recording why, since their
absence might otherwise look like a gap:

- **Reports** (Phase 14) are computed live from `AuditScore`/`AuditIssue` on every request —
  deliberately not persisted, so a report can never show stale data. See
  `docs/progress/PHASE-14.md`.
- **Usage tracking/billing** is explicitly out of scope for this release per the master build
  constraints ("complex billing" is a named exclusion — see `docs/PRODUCT.md`), so `UsageRecord`
  had no feature that was ever going to populate it.

Removing unused schema here, rather than leaving it as unexplained dead weight, keeps the schema
an accurate reflection of what the product actually does.
