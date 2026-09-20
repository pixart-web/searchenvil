# SearchAnvil Worker — deployment artifact only. Building this image does not deploy anything;
# see docs/DEPLOYMENT.md. This build has never been run against a production target from this repo.
#
# SA-RC21 finding #2: every stage is built on Microsoft's official Playwright image, which ships
# Chromium (and every OS-level dependency it needs — fonts, shared libs) already installed at
# build time, matching the exact playwright-core version this workspace depends on. No browser is
# downloaded when a container starts, and nothing needs installing inside a running container.
# All stages share this one base (rather than building on Alpine and copying into a Debian-based
# runtime) specifically so Prisma's generated query engine binary matches the runtime's libc —
# generating it on Alpine (musl) and running it on this Debian-based image (glibc) crashes at
# startup with a binary-target mismatch, a real bug this Dockerfile hit and fixed during SA-RC21
# (see docs/DEPLOYMENT.md's Docker verification section for how this was actually built and
# smoke tested, container included).
#
# CHROMIUM_EXECUTABLE_PATH is resolved at container start (not baked in as a fixed string) by
# asking playwright-core's own API for the path it already knows about — a local filesystem
# lookup against the pre-installed browser, not a network call — so it's correct regardless of
# the exact Chromium revision folder name a given playwright-core version expects.

# Pin the exact playwright-core version this workspace resolves to (see pnpm-lock.yaml) so the
# pre-installed Chromium revision in this image always matches what playwright-core expects.
FROM mcr.microsoft.com/playwright:v1.63.0-noble AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PNPM_HOME/bin:$PATH"
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
RUN pnpm --filter @searchanvil/database run generate
RUN pnpm turbo run build --filter=@searchanvil/worker

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN groupadd --system searchanvil \
  && useradd --system --create-home --home-dir /home/searchanvil --gid searchanvil searchanvil
COPY --from=installer /app .
RUN chown -R searchanvil:searchanvil /app
USER searchanvil
ENV HOME=/home/searchanvil
WORKDIR /app/apps/worker
# Runs the compiled entrypoint directly (not `pnpm start`) — no package-manager/corepack
# indirection needed at container runtime, only at build time. Resolves CHROMIUM_EXECUTABLE_PATH
# from the browser already installed in this image (a local lookup against playwright-core's own
# path-resolution logic, not a download) before starting the worker, so
# PERFORMANCE_WORKER_CONCURRENCY jobs run with real performance sampling out of the box — no
# external CHROMIUM_EXECUTABLE_PATH configuration required for this capability to work in
# production. playwright-core is a direct dependency of @searchanvil/worker specifically so this
# require() resolves under pnpm's strict (non-hoisting) node_modules layout.
CMD ["sh", "-c", "export CHROMIUM_EXECUTABLE_PATH=\"$(node -e 'console.log(require(\"playwright-core\").chromium.executablePath())')\" && exec node dist/main.js"]
