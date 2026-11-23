# SA-DESKTOP-03 live pipeline recovery

The starting point was the 0.1.2 implementation at `7bd28a20eae6712eba7f17cffa53c2ed44028e10`. The prior QA report is retained as historical evidence. The recovery implementation and test harness are in `315cf1114a640969cf3bd0e53096f877e7949bde`.

## Method

A test-only worker entry runs the actual crawler, persistence, audit, scoring and performance code against a disposable PostgreSQL and Redis instance. API requests submit the jobs through the normal routes. A fixed loopback website provides HTML, robots.txt and a sitemap. Existing crawler dispatcher injection and a test-only browser proxy route requests exclusively to the fixture. Production SSRF and Chromium egress controls were left intact and the packaged production workflow runs independently.

The harness holds actual HTTP responses, pauses the owned worker before claim, or blocks at a real Prisma operation or rule evaluation. Each barrier signals the test when it is reached. The harness kills the runtime host, then verifies recorded process identities and listener addresses, restarts with the same profile, checks recovery state and completes a new crawl, audit and Chromium sampling cycle. The old 0.1.2 seeded-state check is retained. The immediate-relaunch check uses the real Electron parent process and holds its worker long enough to prove overlap during restart.

## Final result

The 0.1.3 arm64 DMG and copied app were verified on macOS 27.2.1. The integrated run passed all ten QA phases and the existing 329 automated tests. The 11 live checkpoints passed using runtime files from the copied app. The unmodified app passed ordinary forced quit and immediate replacement while the old PostgreSQL was still alive. The immediate test recorded the old services exiting in 4,206 ms with the worker deliberately held. The installed production app also completed the live audit, performance and CSV workflow.

| Artifact or evidence | Location |
| --- | --- |
| Internal arm64 DMG | `apps/desktop/dist/SearchAnvil-0.1.3-arm64.dmg` |
| Verified DMG SHA-256 | `8c13e204034efcc2fdd08e573cdf5190d9ff5a5e7a10939a87ac8a2caa1411b8` |
| Per-phase results | `apps/desktop/dist/QA_RESULTS.json` |
| Checkpoint and execution output | `apps/desktop/dist/QA_EXECUTION.log` |

Reproduce with the copied app and bundled native binary paths from the [QA runner instructions](EXHAUSTIVE_QA_REPORT.md). Set `SEARCHANVIL_QA_LIVE_RECOVERY=1` and `SEARCHANVIL_SMOKE_LIVE=1` for the complete run.

## Checkpoints

| ID | Running stage and trigger | Expected recovery | Observed on final build | Evidence |
| --- | --- | --- | --- | --- |
| LR-01 | API queues a crawl while its own worker is paused | Pending job resumes once | Completed, two pages, one worker claim | `queued` |
| LR-02 | Hold the real robots.txt response | Crawl is failed and no audit is exposed | Passed | `discovery` |
| LR-03 | Hold the real sitemap XML response | Crawl is failed and no audit is exposed | Passed | `sitemap` |
| LR-04 | Hold the real page HTTP response after discovery | Crawl is failed and no audit is exposed | Passed | `http-crawl` |
| LR-05 | Block after a real CrawlPage upsert returns to the persistence pipeline | Partial page data has no completed audit | Passed | `page-persistence` |
| LR-06 | Block after real link insertion | Partial links have no completed audit | Passed | `link-resolution` |
| LR-07 | Block immediately after the first real rule evaluation while the audit call is on stack | Audit fails with no score or findings | Passed | `audit-engine` |
| LR-08 | Block after AuditScore upsert inside the transaction and before commit | Independent reader sees no partial results. Restart marks audit failed | Passed | `audit-persistence` |
| LR-09 | Hold the real Chromium navigation response | Browser processes exit and stale replay preserves recorded samples | Passed, replay consumed without replacing records | `performance` |
| LR-10 | Block after the completion update inside the audit transaction | No visible completion before commit. Recovery reports failure | Passed | `completion` |
| LR-11 | Block after crawl completion succeeds and before audit enqueue | The crawl remains completed and absent audit is reported as interrupted | Passed | `crawl-completion` |
| LR-12 | Kill packaged Electron with the old worker paused, then launch immediately | Replacement waits for old storage to be released and opens the same profile | Passed on the final installed app, old PostgreSQL was alive when replacement launch began | `Immediate replacement launched` |

Each worker checkpoint preserved the previously completed baseline score and findings, kept the cancelled crawl cancelled, and recorded one claim for the interrupted crawl. The test observed old listeners closing before normal relaunch. The Chromium case also checked that a real browser process was present at the barrier and that the recorded process tree was gone after shutdown.

## Baseline defects and remediation

- **LR-D01** The retained 0.1.2 worker published a score before its audit completed. The independent reader observed score 89 at the barrier. Findings, evidence, score and completion now commit atomically. Recovery also removes partial results left by previous versions.
- **LR-D02** A replayed job replaced a failed browser sample with a completed sample and changed an already completed measurement. New desktop follow-on jobs have stable identifiers. Interrupted jobs and recorded terminal samples are preserved on replay.
- **LR-D03** The replacement Electron process can obtain its app instance lock before the old PostgreSQL process exits. Startup now waits for the previous database process to release its lock.
- **QA-04** A fixture occupied the allocated Next listener immediately after reservation release. The baseline exited with an interface bind failure. The runtime now verifies owned listener readiness and retries address conflicts with new ports. The same fixture passed on retest.

The tested code fixes are in `315cf1114a640969cf3bd0e53096f877e7949bde`. Evidence is emitted by the `live-recovery.cjs`, `qa-forced-exit.cjs` and `qa-port-contention.cjs` phases of `pnpm qa:desktop` with `SEARCHANVIL_QA_LIVE_RECOVERY=1`.

## Scope

The test interrupts each named barrier. It does not enumerate every possible database instruction or OS scheduling interleaving. The page and link checkpoints pause after the database write and before the caller continues. Audit score and completion checkpoints pause inside the transaction, before commit. The worker fixture test uses the packaged runtime binaries with a disposable worker entry. Normal and immediate-relaunch checks use the unmodified copied app. Intel, older macOS, and distribution signing are outside this iteration.

**READY FOR INTERNAL MACOS TESTING**
