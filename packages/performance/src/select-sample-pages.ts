export interface SamplePageCandidate {
  id: string;
  normalizedUrl: string;
  depth: number;
  statusCode: number | null;
}

export const DEFAULT_MAX_SAMPLES = 5;

/**
 * Picks a small, deterministic, bounded subset of a crawl's pages to run
 * expensive browser-based analysis against — see docs/PERFORMANCE.md for
 * why this exists at all (section 12/34 of the build spec: never analyze
 * every page). Prioritizes the site's shallowest pages (homepage first,
 * then depth 1, etc.) since those are the pages most users actually land
 * on; only successfully-fetched pages are eligible (analyzing a 404's
 * "performance" is meaningless). Ties broken by URL for determinism.
 */
export function selectSamplePages(
  candidates: SamplePageCandidate[],
  maxSamples: number = DEFAULT_MAX_SAMPLES,
): SamplePageCandidate[] {
  return candidates
    .filter((page) => page.statusCode === 200)
    .sort((a, b) => a.depth - b.depth || a.normalizedUrl.localeCompare(b.normalizedUrl))
    .slice(0, Math.max(0, maxSamples));
}
