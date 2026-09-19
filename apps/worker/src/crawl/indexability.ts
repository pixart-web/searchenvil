/**
 * Direct-signal derivation only (does the page literally declare noindex?)
 * — not an SEO judgment about whether that's good or bad. That
 * interpretation belongs to @searchenvil/audit-engine. See
 * docs/ARCHITECTURE.md ("Crawler ≠ Audit Engine").
 */
export function computeIsIndexable(
  metaRobots: string | undefined,
  xRobotsTag: string | undefined,
): boolean {
  const declaresNoindex = (value: string | undefined): boolean =>
    (value ?? "").toLowerCase().split(",").map((s) => s.trim()).includes("noindex");
  return !declaresNoindex(metaRobots) && !declaresNoindex(xRobotsTag);
}
