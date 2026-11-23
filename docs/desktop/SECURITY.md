# Desktop security review

Electron enables context isolation and renderer sandboxing, disables Node integration and blocks popup windows, webviews and navigation outside the application origin. The sandboxed preload exposes one read-only IPC operation. Main verifies that its caller is the active application window's top frame. The renderer session denies permission requests and app-window egress beyond the local origin.

The loopback gateway requires a random per-launch capability added by main to requests from the app window. Host and Origin are checked before forwarding. The NestJS desktop listener independently verifies the request capability. Shared session, CSRF and organization-role checks protect the feature routes. Local passwords use the existing hashing implementation. Runtime Redis credentials rotate per launch and are written only to a mode-0600 temporary configuration file.

The CSP restricts scripts, fonts, connections and navigation targets to the app origin, blocks child framing and plug-ins, and permits inline scripts and styles required by the current Next.js build. A nonce-based script policy and process recovery after forced termination remain release work.

The crawler uses its original connection-level DNS and redirect checks. The performance collector now uses a short-lived, loopback HTTP(S) proxy backed by that DNS policy, with Chromium's sandbox enabled. Chromium validates TLS through CONNECT. The proxy closes when the measurement finishes, denies private literal addresses, and checks resolved addresses when opening every destination socket.

Dependency review found high and critical advisories in the initial package. Next.js and Undici were updated to patched versions. See [Testing](TESTING.md) for the final scan and [Known limitations](KNOWN_LIMITATIONS.md) for open verification.
