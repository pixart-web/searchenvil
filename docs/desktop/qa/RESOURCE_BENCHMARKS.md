# Resource benchmarks

Single installed arm64 run on macOS 27.2.1 with a disposable fresh profile. The timing started immediately before Playwright launched Electron and ended when the local-workspace heading was rendered. The sample used `ps` over the Electron process tree one second after the window became idle.

| Measurement | Observed |
| --- | --- |
| Fresh launch to local workspace screen | 2,383 ms |
| Processes in sampled tree | 17 |
| Summed resident size | 989 MiB |
| Summed instantaneous reported CPU | 1% |
| Recorded runtime service cleanup after parent SIGKILL | 210 ms |

Summed resident sizes can double-count shared pages. These are single observations rather than a resource budget or a distribution. Active-crawl peak usage, multi-page load, sleep/wake and long-run leakage were not measured.
