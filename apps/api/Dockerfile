# SearchEnvil API — deployment artifact only. Building this image does not deploy anything; see
# docs/DEPLOYMENT.md. This build has never been run against a production target from this repo.

FROM node:22-alpine AS base
RUN corepack enable

# ---- Prune the workspace down to what @searchenvil/api actually needs ----
FROM base AS pruner
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @searchenvil/api --docker

# ---- Install dependencies for the pruned subset ----
FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@searchenvil/api

# ---- Minimal runtime image ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 searchenvil && adduser --system --uid 1001 searchenvil
COPY --from=installer /app .
USER searchenvil
WORKDIR /app/apps/api
EXPOSE 4000
CMD ["pnpm", "start"]
