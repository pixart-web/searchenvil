# SA-DESKTOP-02 QA report

**NOT READY FOR INTERNAL MACOS TESTING**

The final 0.1.2 build ran successfully on Apple Silicon macOS 27.2.1. The tested startup, quit, restart and forced-parent-exit paths passed. The remaining P1 verification gap is failure injection across live pipeline stages and restart timing while the old runtime is still shutting down. Signing and notarization were outside the internal QA gate.

| Reference | Value |
| --- | --- |
| Audited baseline | `08969b0b04d6e9b74b3a54aeb1608611997bf0d7` |
| Tested implementation | `7bd28a20eae6712eba7f17cffa53c2ed44028e10` |
| QA branch | `codex/searchanvil-desktop-exhaustive-qa` |
| Platform | macOS 27.2.1, arm64. Bundle minimum macOS 27.2 |
| Repository assertions | 329 passed, zero failed in the final run. Scenario gaps are tracked separately |
| QA runner phases | Seven passed, zero failed or skipped when configured with the copied app and disposable native services |
| Production dependency audit | Zero critical, zero high, four moderate |

## QA passes

1. **Baseline discovery.** Inventoried desktop routes, Nest endpoints, crawler and worker paths, existing fixtures and packaged smoke checks. A disposable runtime host leaked all five captured service processes after SIGKILL.
2. **Remediation and regression.** Moved service ownership to a disconnect-aware supervisor, reconciled interrupted crawl and audit state, deduplicated pending queue submissions, waited for worker readiness and fixed the cancellation race. Lint, type checking, tests, build, migrations and API E2E passed. The first packaged pass exposed a normal-quit hang after service shutdown. Changed the supervisor handshake and retested.
3. **Final copied-app validation.** Verified the new DMG and signature seal, copied the app from the image and ran live functional smoke, quit/relaunch, upgrade from 0.1.1, and actual Electron SIGKILL. The force test used a controlled database fixture for the running crawl and a completed audit. After relaunch, the interrupted crawl was failed and the completed audit remained completed.

## Reproduce

Configure the test runner with the copied app and the path to its staged PostgreSQL and Redis binaries. It creates its own disposable database and Redis instance. Set `SEARCHANVIL_SMOKE_LIVE=1` to add the bounded public example.com smoke. When no macOS executable or native test binaries are provided, the runner records the affected phase as skipped. A nonzero phase fails the command.

```sh
SEARCHANVIL_QA_EXECUTABLE=/path/to/SearchAnvil.app/Contents/MacOS/SearchAnvil \
SEARCHANVIL_QA_REPOSITORY_NATIVE=/path/to/SearchAnvil.app/Contents/Resources/runtime/native/bin \
SEARCHANVIL_QA_RESULTS=/tmp/searchanvil-qa-results.json \
pnpm qa:desktop
```

## Evidence and limits

- [Functional coverage matrix](FUNCTIONAL_COVERAGE_MATRIX.md)
- [Defect register](DEFECT_REGISTER.md)
- [Security results](SECURITY_RESULTS.md)
- [Packaged app and checksum](PACKAGED_APP_RESULTS.md)
- [Resource observations](RESOURCE_BENCHMARKS.md)

The final suite covers a fresh disposable profile on the build Mac. An independent clean Mac, Intel, older macOS, all-screen manual accessibility, exhaustive per-rule fixture combinations, network disconnection, disk-full and sleep/wake were unverified. The QA command supports portable lint/type checks and macOS-app tests. CI workflow execution was outside this run.
