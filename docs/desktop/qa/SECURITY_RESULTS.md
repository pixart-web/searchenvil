# Security results

The production pnpm scan reports 0 critical, 0 high and 4 moderate advisories. The two file-type findings enter through Nest's file validation package. The desktop API has no multipart upload route that invokes file-type validation. Minimatch is pulled in through the ESLint/TypeScript parser graph. User-controlled glob processing was not found in the desktop feature routes. Nest core remains a runtime dependency. Applicability of its downstream-output injection advisory is unconfirmed. The patched versions require major dependency changes, which were deferred for this QA iteration.

The gateway and API tests executed capability and origin checks, local route authorization and session/CSRF coverage. The Electron smoke checked main-frame status access, context isolation, sandbox configuration and popup denial. The crawler suites ran existing defensive lookup, redirect, timeout, payload-size, parsing and sitemap fixtures. Performance egress used its existing private-destination rejection fixture. Full permission-matrix testing, preload misuse from every frame type, secrets-in-log automation and independent analysis of all native dependencies remain unverified.

## Native inventory

The inspected staged PostgreSQL 16 executables, Redis and their load dependencies are Mach-O binaries. PostgreSQL, Redis, libpq, plpgsql, OpenSSL, zstd, gettext and ICU report macOS 26.0 deployment targets. Kerberos and com_err report 27.0. liblz4 reports 27.2, the highest inspected target and the bundle minimum. The bundled Node binary reports 11.0. The copied arm64 app ran on macOS 27.2.1. These Mach-O checks establish deployment targets for the inspected components. A native CVE inventory, Intel and older-macOS launch tests remain open.
