# Packaged app results

## SearchAnvil 0.1.3

The arm64 disk image passed `hdiutil verify`. It was mounted read-only and the app was copied to a disposable Applications directory. The copied app passed `codesign --verify --deep --strict` and ran on Apple Silicon macOS 27.2.1. The bundle minimum is macOS 27.2.

- [DMG](../../../apps/desktop/dist/SearchAnvil-0.1.3-arm64.dmg)
- [SHA-256 checksums](../../../apps/desktop/dist/SHA256SUMS)
- [Machine-readable QA results](../../../apps/desktop/dist/QA_RESULTS.json)
- [Execution log](../../../apps/desktop/dist/QA_EXECUTION.log)
- [Overview screenshot](../../../apps/desktop/dist/SearchAnvil-Overview.png)

DMG SHA-256 `8c13e204034efcc2fdd08e573cdf5190d9ff5a5e7a10939a87ac8a2caa1411b8`.

The production app passed login and workspace creation, two bounded live audits, comparison, performance measurement, CSV export and persistence after quit and restart. The 820 × 600 overflow check and renderer isolation checks also passed. All 11 fixture checkpoints passed using runtime binaries from the same copied app. The unmodified app passed immediate restart while the previous database was still alive, and no recorded service survived cleanup. See [live recovery results](LIVE_RECOVERY_REPORT.md) for process and state checks. Signing and notarization were outside this QA gate.

The prior 0.1.2 result and upgrade evidence are preserved in the repository history. This iteration focused on restart and crash recovery.
