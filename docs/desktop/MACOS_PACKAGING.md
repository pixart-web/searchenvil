# macOS packaging

Build on the target CPU architecture with macOS command-line tools, Python 3, Node.js 22, pnpm 9.15.4, PostgreSQL 16 and Redis. The build host also needs the official macOS Node.js 22 distribution for the target architecture. Verify that archive against its upstream checksum before staging. End users receive these runtimes inside the app bundle.

Run the following commands from the repository root.

```sh
pnpm install --frozen-lockfile
SEARCHANVIL_NODE_DIST=/absolute/path/to/extracted/node-distribution \
  pnpm --filter @searchanvil/desktop stage:mac
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm --filter @searchanvil/desktop package:mac --arm64
```

The staging script accepts `SEARCHANVIL_POSTGRES` and `SEARCHANVIL_REDIS` as absolute paths to the build-host installations. It relocates native dependencies, packages the standalone Next app and production API and worker trees, copies Prisma assets, and downloads the Playwright-matched Chromium. For a repeat build, move the previous staging directory aside first.

Electron Builder emits the app and DMG under `apps/desktop/dist`. The identifier `pt.pixart.searchanvil` matches the requested local bundle identity. Registration with an Apple Developer team remains to be verified when distribution signing is configured. For Developer ID builds, use the Electron Builder signing and notarization environment credentials in the build environment.

To install for authorized internal testing, open the DMG and drag SearchAnvil into Applications. Launch SearchAnvil, then create a local workspace. This build uses ad-hoc signing with no Developer ID or notarization, so macOS can reject the quarantined app under Gatekeeper. Public distribution requires Developer ID signing and notarization.

The internal arm64 build declares macOS 27.2. The highest deployment target among the bundled PostgreSQL and Redis dependencies is 27.2, and runtime verification used macOS 27.2.1. Older macOS releases and Intel Macs have no verified build.

Verification of the final disk image passed with `hdiutil verify`. The installed copy passed `codesign --verify --deep --strict`. The same copy was rejected by `spctl --assess --type execute`, consistent with the ad-hoc, unnotarized build. The SHA-256 manifest contains the DMG checksum and the app's signed resource seal checksum.
