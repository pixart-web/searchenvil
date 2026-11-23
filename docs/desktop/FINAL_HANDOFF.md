# SearchAnvil macOS internal build

## Release recommendation

**NOT READY FOR EXTERNAL DESKTOP AUDIT**

The arm64 app and DMG are internal test assets. The package uses ad-hoc signing and has no notarization. Bundled native dependencies establish macOS 27.2 as the deployment floor. Testing used the arm64 build Mac on macOS 27.2.1.

## Architecture

The Electron app supervises bundled PostgreSQL, Redis, NestJS, Next.js and BullMQ workers. Keeping the existing database provider and queues preserves schema, migrations, data types and job contracts for future Web development. Shared packages supply the crawler, audit rules, scoring, priorities and performance analysis. See [the runtime decision](ARCHITECTURE_DECISION.md).

## Functional parity

| Capability | Existing Web | macOS internal build |
| --- | --- | --- |
| Authentication and organizations | Session-based tenant accounts and organization roles | Local signup and sessions reuse the account and organization-role models. Desktop email reset and automatic macOS identity provisioning are open |
| Projects and sites | NestJS project and site routes and web onboarding | Local creation and project access verified through Electron |
| Crawl configuration and execution | Existing bounded configuration, robots and sitemap handling | Packaged worker runs the shared crawler. Audits exposes launch and stage progress. Existing API crawl limits and cancellation remain in use |
| Audit, Search Health and Forge Priorities | Shared rules and scoring, persisted in PostgreSQL | Two live crawls and scoring verified. The same rules and scoring packages are packaged |
| Issues and page intelligence | Filterable issue and page views with details | Existing views under the desktop shell. Issue and page detail verified |
| Performance | Separate queue and configured Playwright browser | Bundled browser and bounded queue. Live completed sample verified |
| Comparison | Shared comparison endpoint and project audit history | Compared two packaged-app crawls through the renderer |
| Reports | Scored report with CSV output | Existing report and CSV output verified. Native destination dialog is wired |
| Settings | Existing web account and site controls | Local runtime panel and native menu entry |
| Recovery and offline | Dependent on access to the hosted application | Local persistence verified on restart. Physical disconnection, staged migrations with existing user data and forced recovery still need release runs |

## Interface

The desktop uses a command bar with project and target context, compact navigation, constrained scrolling and a local runtime footer. The overview follows the supplied operations-console reference with a diagnostic metric strip, category health matrix, linked priority queue and crawl activity panel. The matrix, counts and status reflect stored audit data. Screen-specific UX and accessibility work is listed in [Known limitations](KNOWN_LIMITATIONS.md).

## Security

The dedicated renderer session has Node isolation, sandboxing, blocked popups and an origin-limited network path. Loopback API requests require a launch capability in addition to the existing login and role controls. Crawl protection uses the existing DNS and redirect checks. Performance Chromium uses the same DNS policy in its network proxy. The final dependency scan found zero critical and 14 high advisories in the production dependency graph. See [Security](SECURITY.md).

## Test results

Dependency installation and all five migrations passed. The final lint, typecheck, test, build and API E2E runs passed on local isolated services. The packaged arm64 app completed the live crawl workflow and retained the saved project after quit and relaunch. See [Testing](TESTING.md) for commands and scope.

## Artifacts

- App bundle `apps/desktop/dist/mac-arm64/SearchAnvil.app`
- Disk image `apps/desktop/dist/SearchAnvil-0.1.0-arm64.dmg`
- Integrity records `apps/desktop/dist/SHA256SUMS`

See [Build and install on macOS](MACOS_PACKAGING.md) for internal installation and Developer ID signing information. Review [Known limitations](KNOWN_LIMITATIONS.md) for the outstanding P1–P3 items.
