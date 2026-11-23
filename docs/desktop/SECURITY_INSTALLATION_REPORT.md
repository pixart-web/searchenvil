# SearchAnvil 0.1.1 security and installation report

## Dependency remediation

The initial production dependency scan reported 14 high-severity advisories. The patched workspace scan reported **0 critical, 0 high, 4 moderate and 0 low**.

| Dependency | Remediation |
| --- | --- |
| Multer | Pinned Nest's Express adapter to 2.5.0 |
| body-parser | Pinned the Nest and Express 4 paths to 1.20.9 |
| Lodash | Pinned the Nest config path to 4.18.0 |
| PostCSS | Pinned Next's PostCSS path to 8.5.23 |
| deepmerge-ts and Effect | Pinned the Prisma config paths to 8.0.0 and 3.22.1 |
| Zod | Removed the unused direct dependency from the shared package |
| qs and Nodemailer | Updated compatible versions to resolve additional moderate findings |

The four remaining moderate advisories concern `file-type` (two), `@nestjs/core` and `minimatch`. Their documented fixes require major-version changes along the affected dependency paths. Scope was limited to the reported high findings and compatible related upgrades. Scan coverage is the production pnpm dependency graph. Native binaries and upstream vendored libraries need separate vulnerability inventory.

## Verification

The frozen-lockfile install, five Prisma migrations, lint, type checking, tests, build and API E2E suite passed with isolated PostgreSQL and Redis. The staged macOS runtime accepted a disposable workspace login, rejected an invalid password, cancelled a queued crawl, created a readable pre-migration archive and retained workspace data after a forced worker exit and supervisor shutdown. A bundled Chromium instance rendered an offline fixture.

All test credentials were generated for disposable profiles on the build Mac. Test scripts keep passwords in memory. The package and repository contain no test passwords.

## Installed-copy results

On the arm64 build Mac running macOS 27.2.1, the DMG passed image verification and both SHA-256 checks. The app was copied from its read-only mounted DMG to a disposable Applications directory and passed deep code-signature verification. The installed app ran two live crawls, scored and compared them, showed issue and page details, completed a performance sample and exported CSV. Workspace persistence passed after relaunch. A separate test created a workspace in 0.1.0 and opened its saved project in 0.1.1 using the same isolated data directory. The installed runtime also passed the worker failure, backup and cancellation checks. The pre-migration dump was restored into a separate disposable PostgreSQL cluster, where the expected account and project records were verified.

Artifacts are under `apps/desktop/dist/`: `SearchAnvil-0.1.1-arm64.dmg`, `mac-arm64/SearchAnvil.app`, and `SHA256SUMS`. The DMG SHA-256 is `427d8c43db44b1c2a12154cc75246e6009b3473925f75cf9ec42fd1d5e1b3499`.

## Signing and remaining release gates

This Mac returned zero valid code-signing identities. Version 0.1.1 is an ad-hoc signed arm64 build for internal testing. Gatekeeper rejected the installed copy during assessment. A Developer ID Application certificate must come from the authorized Apple Developer team, and macOS distribution requires signing and notarization through that team. [Apple Developer ID certificates](https://developer.apple.com/help/account/certificates/create-developer-id-certificates)

Remaining release work includes Developer ID signing, a notarized Gatekeeper launch, validation on a separate clean Mac, recovery after force-quitting the parent application or interrupting an active audit.

**NOT READY FOR EXTERNAL DESKTOP AUDIT**
