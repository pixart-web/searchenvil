# Phase 05 — Crawler Foundation

**Status: COMPLETE — gate passed.**

## Scope implemented

`@searchenvil/crawler` — a fact-collecting crawler, no SEO interpretation (see
`docs/ARCHITECTURE.md`, `docs/CRAWLER.md`):

- **SSRF protection** (`ssrf.ts`): resolved-IP validation (not hostname pattern matching) against
  a blocklist covering loopback, RFC 1918 private ranges, link-local (including the
  `169.254.169.254` cloud metadata endpoint), CGNAT, multicast, and other non-public IPv4/IPv6
  ranges (including IPv4-mapped IPv6 unwrapping). Wired into undici via a custom DNS `lookup`
  function on the fetch `Agent`, closing the DNS-rebinding TOCTOU gap a separate
  resolve-then-connect approach would leave open. See ADR-007.
- **Safe HTTP fetcher** (`fetcher.ts`): manual, bounded (max 5) redirect following with SSRF
  re-validation on every hop, 10MB response size cap, configurable timeout, never throws for an
  ordinary fetch failure (reports it in the result instead, so a crawl records a failed page as a
  fact rather than crashing).
- **robots.txt parser** (`robots.ts`): `User-agent`/`Allow`/`Disallow`/`Sitemap`, RFC 9309
  group-selection (most specific agent match, falling back to `*`), longest-rule-wins path
  matching with `*`/`$` support.
- **Sitemap parser** (`sitemap.ts`): `<urlset>` and `<sitemapindex>`, via `cheerio` in XML mode.
- **Fact extraction** (`parser.ts`): title, meta description, meta robots, language, all headings
  (1–6, in order), canonical (resolved absolute), word count, links (resolved + same-origin
  classification), images (**missing vs. empty `alt` distinguished**), JSON-LD structured data
  (malformed JSON reported as `isValid: false`, not thrown), OpenGraph tags.
- **Concurrency-limited BFS crawler** (`crawler.ts`, `concurrency-pool.ts`): dedup via
  `normalizeUrl` (from Phase 01's `@searchenvil/shared`), same-origin-only traversal,
  robots-aware link filtering, bounded by `maxPages`/`maxDepth`/`concurrency`. Hand-rolled
  concurrency pool rather than a dependency — see ADR-007.

## Key files

- `packages/crawler/src/{ssrf,fetcher,robots,sitemap,parser,crawler,concurrency-pool,types}.ts`
- `packages/crawler/src/fixtures/fixture-server.ts` (test-only)

## Tests added

45 tests, all against a local in-process fixture HTTP server — **never a real/public website**
(section 31 of the build spec):

- `ssrf.spec.ts` (8) — every blocked range (loopback, private v4, link-local/cloud-metadata,
  unique-local/link-local v6, unspecified/multicast/broadcast, IPv4-mapped v6 unwrapping), and
  that public addresses are allowed.
- `robots.spec.ts` (9) — sitemap collection, most-specific-group selection, wildcard fallback,
  empty-Disallow-means-allow-all, comment/blank-line handling, longest-rule-wins.
- `sitemap.spec.ts` (3) — leaf urlset, sitemap index, malformed-XML doesn't throw.
- `parser.spec.ts` (10) — every fact field, including the missing-vs-empty-alt distinction and
  malformed-JSON-LD handling.
- `fetcher.spec.ts` (6) — status/body/content-type capture, redirect-chain recording,
  too-many-redirects termination, 5xx reported as a fact (not an error), connection failure
  reported as a fact, **and a default-configuration test proving `safeFetch` actually refuses a
  loopback address end-to-end** (not just that the range-check logic is correct in isolation).
- `concurrency-pool.spec.ts` (5) — exactly-once processing, concurrency limit respected,
  mid-run `enqueue` from a worker, one failure doesn't abort the run, empty-queue resolves
  immediately.
- `crawler.spec.ts` (4) — **the Phase 05 gate**: a deterministic multi-page fixture site is
  crawled correctly (every internal page visited, robots-disallowed page never fetched, external
  link never followed, redirect chain recorded, 404 recorded without error), no URL is ever
  crawled twice even when reachable via multiple links, `maxPages` and `maxDepth` are both
  enforced.

## Commands executed and results

```
pnpm --filter @searchenvil/crawler run test       → 45/45 passed
pnpm --filter @searchenvil/crawler run build       → succeeded
pnpm --filter @searchenvil/crawler run typecheck   → succeeded
pnpm --filter @searchenvil/crawler run lint        → succeeded
pnpm build / typecheck / lint / test (full workspace) → all green
```

## Architecture decisions

ADR-007 (hand-rolled concurrency pool + SSRF-safe DNS lookup) — see `docs/DECISIONS.md`.

## Bugs found during self-audit and fixes made

- `readBodyBounded`'s redirect-handling path originally called `response.body.destroy()` on an
  undrained redirect response, which throws an uncaught `AbortError` inside undici — invisible in
  individual test assertions (all 36 tests reported as passing) but surfaced as 7 unhandled
  rejections failing the overall test run. Switched to `response.body.dump()`, undici's documented
  way to discard a body without reading it.
- `wordCount` initially undercounted by one word per test fixture: `cheerio`'s `.text()`
  concatenates block-level elements with no separator (`<p>a</p><p>b</p>` → `"ab"`, not `"a b"`),
  unlike a rendered browser. Fixed by injecting a space after block-level elements
  (`p, div, li, br, h1-h6, tr, section, article, header, footer`) before extracting text — caught
  by the `parser.spec.ts` word-count test, not discovered later against real content.
- `packages/tsconfig/base.json`'s `noUncheckedIndexedAccess: true` (set in Phase 01) surfaced
  real gaps once the crawler started doing array indexing on untrusted/split input (IP octets,
  robots.txt lines, DNS results) — 17 type errors across `ssrf.ts`, `robots.ts`, and test files.
  Fixed each at the actual point of use (explicit `?? 0` defaults for numeric parsing, a guarded
  `first` binding instead of `list[0]` for the DNS callback, non-null assertions only where the
  array length is genuinely guaranteed — e.g. splitting a hardcoded internal CIDR string, or
  indexing a test fixture array right after asserting its length). Not disabled the check to make
  the errors go away — it caught real "what if this is empty" gaps worth having thought through.
- `fetcher.ts` initially passed `maxRedirections: 0` to undici's `request()`, which isn't a valid
  option on that API (it belongs to a different undici interface) and failed to typecheck; removed
  since redirects are already handled manually.

## Known limitations / technical debt

Documented in full in `docs/CRAWLER.md` ("Known limitations"): no JS-rendering fallback (by
design — see section 9/34 of the build spec, "prefer direct HTTP fetching," and
`docs/ARCHITECTURE.md`'s technology baseline), sitemap URLs are recorded but not yet
cross-referenced against crawl coverage (a Phase 07 audit-rule candidate), and no per-host rate
limiting beyond the global concurrency cap (fine for this release's single-site-per-crawl model).

## Security considerations

This phase's primary deliverable *is* a security control — SSRF protection — documented in depth
in `docs/CRAWLER.md` and cross-referenced from `docs/SECURITY.md`. Verified by both targeted unit
tests (the IP-range blocklist) and an integration test proving the protection actually engages
end-to-end through `safeFetch`'s default configuration, not just that the underlying logic is
correct in isolation.

## Readiness for next phase

Gate met: a deterministic fixture website is crawled reliably, verified by automated tests, not
asserted from memory. The crawler package is a standalone, fully-tested unit — Phase 06 wires its
output into Postgres persistence, real crawl status, and the worker queue.
