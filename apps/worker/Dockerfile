# SearchAnvil Worker — deployment artifact only. Building this image does not deploy anything;
# see docs/DEPLOYMENT.md. This build has never been run against a production target from this repo.
#
# The performance-sampling capability (packages/performance) needs a provisioned Chromium binary
# at CHROMIUM_EXECUTABLE_PATH — see docs/PERFORMANCE.md. This base image does not include one;
# without it the worker still runs crawl/audit jobs correctly and just skips performance sampling
# (a warning is logged, nothing crashes). Provisioning Chromium into the runtime image (or a
# sidecar) is a deployment-time decision left to docs/DEPLOYMENT.md, not baked in here, since
# whether performance sampling is wanted in a given environment is itself a deployment choice.

FROM node:22-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @searchanvil/worker --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@searchanvil/worker

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 searchanvil && adduser --system --uid 1001 searchanvil
COPY --from=installer /app .
USER searchanvil
WORKDIR /app/apps/worker
CMD ["pnpm", "start"]
