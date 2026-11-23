# Known limitations

| Priority | Open item |
| --- | --- |
| P1 | Full forced-termination and sleep/wake recovery is pending. BullMQ persists work, but a hard kill can leave processes or partially persisted audits that require controlled recovery. |
| P1 | Production dependency advisories remain after updating the affected Next.js and Undici versions. Reachability triage and upstream dependency updates are required before the security gate can pass. |
| P1 | The package needs a clean-machine installation and upgrade/restore drill. The internal arm64 test uses the build Mac. Intel and older macOS compatibility are unverified. |
| P2 | The command shell and shared styling cover the existing routes. The remaining screen-specific layouts, optional evidence inspector, richer project status and resize/accessibility review are pending. |
| P2 | Local workspace accounts reuse existing email and password fields. Email acts as a local identifier. Desktop account reset and macOS identity bootstrap have no dedicated workflow. |
| P2 | The native CSV handler is wired. Automated checks verify the CSV payload; dialog interaction requires a manual pass. |
| P3 | The package includes full browser and service runtimes. Package size and idle resource tuning remain unmeasured. |
