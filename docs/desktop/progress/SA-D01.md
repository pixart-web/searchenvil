# SA-D01 Repository assessment

Baseline is `89a24cba62617441028be1619a886258d4f5f9bd` from `pixart-web/searchenvil`.

| Area | Existing implementation | Desktop implication |
| --- | --- | --- |
| UI | Next App Router with React client feature routes, shared UI package and a separate marketing route group | Reuse project routes and workflows with desktop-specific styling and shell. Start inside the app route group |
| Identity and tenancy | Nest session and organization role guards, hashed credentials and CSRF | Provision a local workspace identity and preserve organization scoping |
| Storage | Prisma on PostgreSQL with checked-in SQL migrations | Bundle and supervise a private cluster. Validate migration and restart on the packaged runtime |
| Execution | BullMQ workers dispatch crawl, audit and performance; PostgreSQL persists results and progress | Preserve job contracts and add packaged recovery tests, including interruptions between stages |
| Crawling | Shared crawler handles robots, sitemap, request constraints and SSRF validation | Run unchanged under the same policy in the packaged worker |
| Audit | Shared rule registry, scoring, priorities and persistence routines | Existing tests are the parity baseline |
| Performance | Playwright collector configured with an explicit Chromium executable path | Package a corresponding browser for every architecture and verify its sandbox and cleanup |
| Reporting | Nest report service and CSV routes, with renderer-side report links | Reuse existing output and route save through the macOS dialog |

The current host is Darwin arm64. Homebrew PostgreSQL 16 has absolute dependencies in `/opt/homebrew`, so copying the executables alone would leave the distribution dependent on developer tooling. A packaging build must stage the matching share directory and resolve and relocate the transitive native dependencies or source independently relocatable binaries.
