# Development

## Prerequisites

- Node.js 22.x (see `.node-version`). Node 25 also works for local iteration but CI and
  production target 22 LTS.
- pnpm 9.x (`npm install -g pnpm`, or `corepack enable && corepack prepare pnpm@9.15.4
  --activate` where corepack is available)
- Docker (for local Postgres + Redis)

## First-time setup

```bash
cp .env.example .env
pnpm install
docker-compose up -d          # Postgres on :5433, Redis on :6380 (see note below)
pnpm db:generate
pnpm db:migrate                # applies migrations, prompts for a name on schema changes
pnpm db:seed                   # creates demo@searchenvil.com / ChangeMe123!
```

> **Non-default ports**: `docker-compose.yml` exposes Postgres on host port `5433` and Redis on
> `6380` instead of the defaults, to avoid colliding with other local Postgres/Redis instances on
> a dev machine. `.env.example` matches these. Change both together if you'd rather use the
> defaults.

## Running the apps

```bash
pnpm --filter @searchenvil/api run dev       # NestJS API on :4000 (reload on change)
pnpm --filter @searchenvil/worker run dev    # BullMQ worker (reload on change)
pnpm --filter @searchenvil/web run dev       # Next.js on :3000
```

Or run everything Turborepo knows about concurrently: `pnpm dev`.

## Verifying your environment

```bash
curl http://localhost:4000/health   # {"status":"ok"}
curl http://localhost:4000/ready    # {"status":"ok","checks":{"database":"ok","redis":"ok"}}
```

## Common commands

| Command | What it does |
|---|---|
| `pnpm build` | Build every app/package via Turborepo |
| `pnpm lint` | ESLint across the workspace |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm test` | Unit/integration tests (Vitest) across the workspace |
| `pnpm test:e2e` | End-to-end tests (added starting Phase 03) |
| `pnpm format` | Prettier write |
| `pnpm db:migrate` | `prisma migrate dev` against `packages/database/prisma/schema.prisma` |
| `pnpm db:seed` | Seed demo data |

## Adding a package

Follow the existing shape in `packages/*`: a `package.json` with `build`/`dev`/`lint`/`typecheck`/
`test`/`clean` scripts, a `tsconfig.json` extending `@searchenvil/tsconfig/node-library.json` (or
`nextjs.json`/`nestjs.json` for apps), and a `.eslintrc.json` extending
`@searchenvil/eslint-config`. Add it to `pnpm-workspace.yaml` implicitly by placing it under
`apps/` or `packages/` — no further registration needed.

## Code quality gates

Every change should pass, in this order, before it's considered done: `pnpm lint`, `pnpm
typecheck`, `pnpm test`, `pnpm build`. CI (`.github/workflows/ci.yml`) runs the same sequence
against real Postgres/Redis service containers.
