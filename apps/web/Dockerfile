# SearchEnvil Web — deployment artifact only. Building this image does not deploy anything; see
# docs/DEPLOYMENT.md. This build has never been run against a production target from this repo.

FROM node:22-alpine AS base
RUN corepack enable

FROM base AS pruner
WORKDIR /app
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @searchenvil/web --docker

FROM base AS installer
WORKDIR /app
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
# NEXT_PUBLIC_* vars are baked into the client bundle at build time — pass the real value here at
# image-build time, not just at container-run time, or the deployed frontend will call the wrong API.
ARG NEXT_PUBLIC_API_URL="http://localhost:4000"
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN pnpm turbo run build --filter=@searchenvil/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 searchenvil && adduser --system --uid 1001 searchenvil
COPY --from=installer /app .
USER searchenvil
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["pnpm", "start"]
