# Desktop verification

## Repository regression

The initial baseline passed `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm build` and `pnpm test:e2e` against an isolated PostgreSQL and Redis instance with all five migrations applied. The first test attempt needed a database connection for the existing worker integration suite. Rerunning with a fresh database and Redis passed.

## Runtime

`pnpm --filter @searchanvil/desktop test` exercises ingress capability checks, Origin rejection, forwarding rules and the gateway CSP against local fixture servers.

```sh
node apps/desktop/scripts/smoke-runtime.cjs
node apps/desktop/scripts/smoke-electron.cjs \
  apps/desktop/dist/mac-arm64/SearchAnvil.app/Contents/MacOS/SearchAnvil
```

The runtime test exercises first launch, workspace and project creation, API authorization, persistence after restart, shutdown and an offline Chromium fixture. The Electron test exercises the actual native window, renderer sandbox configuration, popup policy and workspace workflows in a temporary profile. Set `SEARCHANVIL_SMOKE_LIVE=1` to run the public-site crawl, audit, comparison, issue, page, performance and CSV checks against example.com.

The packaged workflow complements the deterministic repository crawler, worker and API fixtures. Clean-machine install, UI cancellation under a controlled slow network, browser process recovery after force quit, native save dialog, and physical network disconnection are separate manual release checks.

## Final repository results

After the dependency and network-policy changes, all five baseline commands passed again on PostgreSQL 16 and Redis 8.8. The test task covered 252 cases including the gateway test. The API E2E task completed 74 cases across 12 suites. The audit command `pnpm audit --prod --json` reported 0 critical, 14 high, 17 moderate and 2 low advisories in the workspace production graph. Advisory reachability in the packaged application has not been fully established.

The final DMG check mounts the disk image read-only and copies SearchAnvil to an isolated Applications folder on the build Mac. It verifies the copied application's code-signature seal, launches it with a temporary user-data directory and exercises the live crawl workflow. The test drives the download handler by selecting a temporary destination programmatically and verifies the saved CSV bytes. Manually choosing the destination in the system save dialog remains a separate check.

The final installed-copy run passed two real audits, issue and page detail, comparison, completed Chromium performance sampling, CSV download and persistence after relaunch. The overview displayed all five severities and their counts summed to the total issues. The workspace had no horizontal overflow at 820 × 600. See `apps/desktop/dist/SearchAnvil-Overview.png` for the default-size screenshot.
