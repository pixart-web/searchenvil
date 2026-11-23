# SearchAnvil macOS runtime decision

Bundle the existing NestJS API, workers, PostgreSQL and Redis for the first desktop edition. Keep the existing Prisma models and production migration history, BullMQ queues, crawler policies, audit rules, scoring and CSV generators as the shared implementation.

## Options assessed

| Criterion | Bundled services | SQLite and durable local jobs |
| --- | --- | --- |
| Parity | Reuses existing migrations, model semantics, aggregate queries and worker lifecycle | Requires a second migration history and compatibility work for PostgreSQL-specific schema types and queries |
| Durability | PostgreSQL transactions and BullMQ recovery are established. Cross-service enqueue and persistence still need interruption tests | A local job table could commit with state changes. Locking, leases, restart policy and cancellation would need implementing and testing |
| Offline operation | All services can run locally | All services can run locally |
| Installation and maintenance | Per-architecture binaries, libraries, relocatable resources and supervised shutdown | Lower process count and a smaller bundle, with two storage and queue implementations to maintain |
| Verification | Existing PostgreSQL and Redis integration tests apply to bundled processes | Requires both provider suites and additional parity tests |

Choose bundled services because the first release prioritizes preserving current data and execution semantics. Revisit SQLite if installed size, idle resources or service supervision prevent meeting the desktop release gates.

## Proposed boundaries

- Electron main owns the lifecycle, isolated user-data directory, session partition, native menus and export dialogs. The renderer runs sandboxed with no Node access. Navigation and network requests are restricted to the desktop application origin.
- Serve the existing Next application from a private loopback listener and proxy allowed API requests on the same origin. Authenticate requests with a per-launch capability inserted by Electron main and shared only with the managed services. Validate host and request origin. Retain the API's normal tenant authorization. Browser isolation alone does not authenticate a loopback client.
- Bind PostgreSQL to a private Unix socket and use a private, authenticated Redis endpoint. Keep database and queue data outside the application bundle with restrictive filesystem permissions. Protect any credentials that must persist with Keychain.
- Bootstrap the local workspace through the existing user, organization and owner-membership models. Use the macOS account boundary and issue ordinary API sessions to that identity through the protected local runtime. The desktop adapter owns bootstrap and session lifecycle. Web authorization continues to use the existing guards.
- Run existing Prisma migrations at startup after a consistent backup where required. If preflight or migration fails, keep the previous data and surface the failed service. Supervise workers separately from the UI and distinguish interrupted jobs from completed ones.
- Bundle Playwright-compatible Chromium beside the worker resources. Keep crawl HTTP and browser requests under the existing crawler and performance collector protections.

## Release gates

Verify binary relocation and dependency closure on a clean arm64 Mac before accepting the design for release. Run the same gate independently for Intel if an x64 build is produced. Verify stale-process and interrupted-job recovery, database migration and rollback, Chromium process cleanup, session isolation, and access to existing audit data with the Mac offline.

## Implementation notes

The internal build uses ordinary local signup and session routes instead of automatic workspace provisioning from the macOS identity. The email address serves as a login identifier inside the Mac's database. Passwords use the existing hashing implementation and authenticated requests retain the existing organization role checks. The Next server binds to loopback and serves the UI. The API and application gateway require per-launch capabilities for their respective routes.
