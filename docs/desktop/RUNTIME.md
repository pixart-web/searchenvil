# Local runtime

Electron obtains a single-instance lock and starts the runtime before opening the window. A per-launch temporary directory contains the PostgreSQL socket, Redis authentication configuration and browser profiles. The supervisor starts PostgreSQL and Redis, deploys the existing Prisma migrations, checks NestJS readiness and starts the standalone Next renderer server and BullMQ worker.

PostgreSQL listens on a private Unix socket. Redis, Next, NestJS and the Electron gateway use loopback listeners. The renderer uses one loopback origin. The gateway forwards the existing API routes to NestJS, while Next.js serves the interface and static assets. Separate crawl, audit and performance queues use concurrency one each.

On normal quit the gateway stops taking clients and the supervisor signals the worker, interface, API, Redis and database in reverse order. PostgreSQL receives the fast-shutdown signal. Child exit is bounded with a forced termination fallback. A service exit during use produces a native runtime error and closes the application. Relaunch starts fresh service processes against the existing storage.

Redis append-only files retain job state. BullMQ owns stalled-job recovery. Recovery of partially persisted audit runs and stale services after forced termination is an open release item. See [Known limitations](KNOWN_LIMITATIONS.md).
