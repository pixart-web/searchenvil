// Audit engine: INTERPRETS facts produced by @searchenvil/crawler into
// findings. Never fetches anything itself. See docs/ARCHITECTURE.md
// ("Crawler ≠ Audit Engine") and docs/AUDIT_ENGINE.md.
export const AUDIT_ENGINE_PACKAGE_VERSION = "0.1.0";

export * from "./types";
export * from "./rule-registry";
export * from "./run-audit";
