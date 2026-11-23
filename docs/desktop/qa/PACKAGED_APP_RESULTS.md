# Packaged app results

The arm64 0.1.2 disk image was verified with `hdiutil verify`, mounted read-only, and copied into an isolated Applications directory. The copied build passed `codesign --verify --deep --strict` and ran with a disposable profile on macOS 27.2.1.

- [DMG](../../../apps/desktop/dist/SearchAnvil-0.1.2-arm64.dmg)
- [Checksums](../../../apps/desktop/dist/SHA256SUMS)
- [Machine-readable phase results](../../../apps/desktop/dist/QA_RESULTS.json)
- [Execution log](../../../apps/desktop/dist/QA_EXECUTION.log)
- [Overview screenshot](../../../apps/desktop/dist/SearchAnvil-Overview.png)

DMG SHA-256 `7e5f14c22b10ad98c79aaf637a68237065ea545091dfe61c3dd5a8cc21bb7681`.

The installed app completed workspace creation, project and site creation, two bounded live audits, issue and page navigation, comparison, performance measurement and CSV save with destination chosen by the test harness. The overview's severity totals matched and no horizontal overflow was found at 820 × 600. Normal quit and relaunch retained the workspace. The same-profile second instance exited while the first window stayed open.

After actual Electron SIGKILL, all recorded supervisor-owned processes exited and the previous gateway was unreachable. Relaunch reconciled a seeded running crawl to failed and preserved a seeded completed crawl and completed audit. The seeded state checks recovery of persisted records. Separately, the normal live smoke exercised actual crawl execution. Signing and notarization were outside the QA gate.

Upgrade verification also passed. A separate disposable profile was seeded with the retained 0.1.1 app and then opened by the copied 0.1.2 app. The previously saved project was still present.
