# SearchAnvil

**Forge Better Search Performance.**

SearchAnvil is a multi-tenant SaaS platform for website intelligence and technical SEO
auditing. It answers five questions for a website owner: How healthy is my website? What is
wrong? What should I fix first? Which pages are affected? Did the website improve since the
previous audit?

This directory is the canonical documentation set for the project. Start here, then follow the
links below depending on what you need.

## Where to start

| I want to... | Read |
|---|---|
| Understand the product and its scope | [PRODUCT.md](./PRODUCT.md) |
| Understand the system architecture | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| Set up a local dev environment | [DEVELOPMENT.md](./DEVELOPMENT.md) |
| Understand the database schema | [DATABASE.md](./DATABASE.md) |
| Understand the crawler | [CRAWLER.md](./CRAWLER.md) |
| Understand the audit engine and rules | [AUDIT_ENGINE.md](./AUDIT_ENGINE.md) |
| Understand Search Health scoring | [SCORING.md](./SCORING.md) |
| Call the API | [API.md](./API.md) |
| Understand security controls | [SECURITY.md](./SECURITY.md) |
| Understand the test strategy | [TESTING.md](./TESTING.md) |
| Understand the design system | [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) |
| Deploy (prepare, not execute) | [DEPLOYMENT.md](./DEPLOYMENT.md) |
| Run day-2 operations | [OPERATIONS.md](./OPERATIONS.md) |
| See architecture decisions | [DECISIONS.md](./DECISIONS.md) |
| Check release readiness | [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) |
| See phase-by-phase build history | [progress/](./progress/) |

## Repository layout

```
apps/
  web/       Next.js application (marketing site + product UI)
  api/       NestJS API (REST, /api/v1)
  worker/    BullMQ worker (crawl, audit, performance, report jobs)
packages/
  audit-engine/   Interprets crawl facts into findings (never talks to the network)
  crawler/        Collects facts from the web (never makes SEO judgments)
  database/       Prisma schema + generated client, shared by api/worker
  queue/          Typed BullMQ queue/job contracts shared by api/worker
  shared/         Framework-agnostic types and utilities (URL normalization, RBAC)
  ui/             SearchAnvil design-system components (Next.js/React)
  eslint-config/  Shared ESLint flat-style configs
  tsconfig/       Shared TypeScript base configs
docs/            This documentation set, plus docs/progress/PHASE-XX.md per build phase
infrastructure/  Deployment-adjacent config (reverse proxy notes, etc.) — prepared, not applied
```

## Status

SearchAnvil is under active build-out, following the phase plan recorded in
`docs/progress/`. See [RELEASE_CHECKLIST.md](./RELEASE_CHECKLIST.md) for current
Release Candidate status.
