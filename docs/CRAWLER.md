# Crawler

`@searchanvil/crawler` collects **facts** from a website. It never makes an SEO judgment — see
`docs/ARCHITECTURE.md` ("Crawler ≠ Audit Engine"). If you're tempted to add "and this is bad
because..." logic here, it belongs in `@searchanvil/audit-engine` instead.

## Pipeline

```
runCrawl(config)
  1. Fetch & parse /robots.txt                          → RobotsTxt { rules, sitemaps }
  2. Recursively discover sitemap page URLs, bounded     → string[]
     (robots-declared sitemaps or /sitemap.xml default,
      walking <sitemapindex> nesting, same-origin only)
  3. Traversal seeded from startUrl + every discovered sitemap URL, bounded by
     maxPages/maxDepth/concurrency
       for each page:
         - safeFetch()                       → FetchResult (SSRF-protected, abortable)
         - extractPageFacts() (if HTML)       → PageFacts
         - discover same-origin links, filtered by robots.txt, deduped by normalizeUrl()
  → CrawlResult { pages, sitemapUrls, robotsTxtFound }
```

## SSRF protection (`ssrf.ts`)

This is the part of the crawler most likely to matter for security, so it gets the most
deliberate design:

- **DNS-resolved-IP validation, not hostname pattern matching.** A hostname like
  `internal.attacker.com` can resolve to `127.0.0.1` — checking the hostname string tells you
  nothing. `isBlockedAddress()` checks the actual resolved IP against a blocklist covering
  loopback, private (RFC 1918), link-local (including the cloud metadata endpoint
  `169.254.169.254`), CGNAT, multicast, and other non-public ranges, for both IPv4 and IPv6
  (including unwrapping IPv4-mapped IPv6 addresses like `::ffff:127.0.0.1`).
- **No TOCTOU gap.** The naive approach — resolve DNS, validate, *then* connect separately — has
  a race: nothing stops the second DNS lookup (the one the actual connection uses) from returning
  a different, unvalidated address (DNS rebinding). `createSafeLookup()` instead plugs directly
  into undici's `Agent({ connect: { lookup } })` option, so the exact IP that gets validated is
  the exact IP the socket connects to — there's no second lookup to race.
- **Every redirect hop is re-validated.** `safeFetch()` disables undici's automatic redirect
  following and walks redirects manually (`fetcher.ts`), so a public host redirecting to
  `http://169.254.169.254/` gets caught on the second hop, not just the first.
- **Fails closed.** An address `isBlockedAddress()` can't even parse is treated as blocked, not
  allowed.

See `apps/api`'s side of this in `docs/API.md`/`docs/SECURITY.md`: site `rootUrl` validation at
creation time is shape-only (well-formed `http(s)` URL) — the SSRF protection described here is
what actually matters, and it applies at fetch time, every time, not just once at input.

## robots.txt (`robots.ts`)

A minimal parser covering `User-agent`, `Allow`, `Disallow`, and `Sitemap` — the directives that
affect crawling. Group selection follows the de-facto standard (RFC 9309): the most specific
matching `User-agent` group wins, falling back to `*`. Path matching supports `*` wildcards and
the `$` end-anchor; the longest matching rule wins on conflict, ties favoring `Allow`.

`respectRobotsTxt: true` (the default) means disallowed URLs are never enqueued for crawling,
including the start URL itself if it's disallowed.

## Sitemap discovery (`sitemap.ts`, `crawler.ts`)

`sitemap.ts` parses `<urlset>` (a leaf sitemap) and `<sitemapindex>` (an index of sitemaps) —
pure, lenient parsing; a malformed document simply yields no URLs rather than throwing.

`crawler.ts`'s `discoverSitemapUrls()` walks this recursively, starting from whatever
`robots.txt` declares (or the conventional `/sitemap.xml` if it declares nothing), following
`<sitemapindex>` nesting. Every discovered page URL is then seeded into the crawl traversal
directly (at depth 0, same as the start URL) — this is what lets a genuinely **orphan page**
(present in the sitemap, never internally linked from any crawled page) actually get crawled and
audited, not just recorded as a URL string in `CrawlResult.sitemapUrls`.

**Bounded, same-origin only.** A sitemap is a small blast-radius input by construction:

| Constant | Value | Purpose |
|---|---|---|
| `MAX_SITEMAP_FILES` | 25 | Total sitemap files (index + leaf combined) fetched per crawl |
| `MAX_SITEMAP_INDEX_DEPTH` | 3 | How many levels of `<sitemapindex>` nesting are followed |
| `MAX_SITEMAP_URLS` | 5000 | Total distinct page URLs accepted from sitemap discovery |

Every candidate sitemap file and every candidate page URL is filtered to the crawl's own origin
before being fetched or enqueued — a sitemap can declare a foreign-origin URL, but it's silently
dropped, never fetched, never crawled. Once a same-origin sitemap URL is accepted as a crawl
candidate, it goes through the exact same `safeFetch`/SSRF-protected path (`fetcher.ts`) as any
other URL — sitemap discovery is a way to propose *candidates*, never a way to bypass the fetch
layer's own protections. `maxPages`, robots rules, deduplication (via the same `visited` set as
link-discovered URLs), and cancellation all apply identically to sitemap-seeded pages.

## Fact extraction (`parser.ts`)

Uses `cheerio` (not a full browser) to extract: title, meta description, `meta robots`, HTML
`lang`, all headings (levels 1–6, in document order — including zero, one, or many H1s; counting
them is the audit engine's job), canonical URL (resolved to absolute), word count (of visible body
text), links (resolved absolute URL, same-origin classification, anchor text, `rel`), images
(`src`, `alt` — critically, **distinguishes a missing `alt` attribute from an empty one**, since
those mean different things for accessibility/SEO), JSON-LD structured data (parsed, with
`isValid`/`errors` for malformed JSON rather than throwing), and OpenGraph tags.

## Concurrency (`concurrency-pool.ts`)

A small hand-rolled limiter, not an external dependency — see `docs/DECISIONS.md` (ADR-007). Runs
up to `concurrency` fetches at once; a page's own worker can enqueue newly-discovered links
directly (`self.enqueue()`), which is what makes the BFS traversal work without a separate queue
manager.

## Limits

| Config field | Default | Purpose |
|---|---|---|
| `maxPages` | 200 | Hard cap on pages fetched in one crawl |
| `maxDepth` | 5 | Hops from the start URL beyond which links aren't followed |
| `concurrency` | 5 | Simultaneous in-flight fetches |
| `requestTimeoutMs` | 15000 | Per-request header/body timeout |
| `respectRobotsTxt` | true | Whether disallowed URLs are skipped |

Response bodies are capped at 10MB (`fetcher.ts`); an oversized response is recorded as an
unparsed page (`body: undefined`) rather than exhausting memory.

## Rendering

**Not implemented in this release.** The crawler is HTTP-fetch + static-HTML-parse only
(`undici` + `cheerio`), deliberately — launching a full browser (Playwright) per page would be
far more expensive and isn't needed for the technical/on-page signals this product's initial
scope covers. If a JS-rendering fallback is ever added, it should be opt-in per crawl, not the
default (see section 9/34 of the build spec).

## Testing

All crawler tests run against a local, in-process HTTP fixture server
(`fixtures/fixture-server.ts`) — never a real/public website (see `docs/TESTING.md`). The main
integration test (`crawler.spec.ts`) builds a small deterministic site with internal links, an
external link, a robots-disallowed page, a redirect, and a 404, and asserts the crawler visits
exactly the right set of pages, dedupes correctly, and stops at `maxPages`/`maxDepth` — this is
the Phase 05 gate ("a deterministic fixture website can be crawled reliably").
`crawler-sitemap.spec.ts` covers sitemap discovery specifically (regular sitemap, sitemap index,
nested indexes, an orphan page reachable only via the sitemap, a URL present in both a link and
the sitemap, a foreign-origin sitemap entry, a malformed sitemap, excessive sitemap-index
expansion, and `maxPages` still holding even when the sitemap alone offers more candidates than
the cap) and cancellation propagation into an in-flight request.

## Cancellation

`RunCrawlOptions.signal` (an `AbortSignal`, wired up by `apps/worker/src/crawl/process-crawl-job.ts`
polling `Crawl.status` for `CANCELLED`) is propagated all the way down to undici's `request()`
call in `safeFetch()`. Aborting stops new fetches from starting **and** aborts whatever request is
currently in flight — it doesn't wait for a slow in-flight request to finish on its own. Timeout
behavior (`requestTimeoutMs`) is independent of and unaffected by this.

## Known limitations (tracked, not silently accepted)

- No JS rendering fallback yet (see above).
- No per-host rate limiting beyond the global `concurrency` cap — fine for auditing a single site
  per crawl (the only mode this release supports), would need revisiting for multi-site
  concurrent crawls sharing infrastructure.
