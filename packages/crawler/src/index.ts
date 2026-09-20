// Crawler package: collects FACTS only. It must never contain SEO
// interpretation — that belongs to @searchanvil/audit-engine.
// See docs/ARCHITECTURE.md ("Crawler ≠ Audit Engine") and docs/CRAWLER.md.
export const CRAWLER_PACKAGE_VERSION = "0.1.0";

export * from "./types";
export * from "./crawler";
export * from "./fetcher";
export * from "./parser";
export * from "./robots";
export * from "./sitemap";
export * from "./ssrf";
export * from "./concurrency-pool";
