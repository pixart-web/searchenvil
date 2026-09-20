# Crawler

`@searchanvil/crawler` collects **facts** from a website. It never makes an SEO judgment — see
`docs/ARCHITECTURE.md` ("Crawler ≠ Audit Engine"). If you're tempted to add "and this is bad
because..." logic here, it belongs in `@searchanvil/audit-engine` instead.

## Pipeline

```
runCrawl(config)
  1. Fetch & parse /robots.txt              → RobotsTxt { rules, sitemaps }
  2. Discover sitemap URLs (robots or /sitemap.xml default) → string[]
  3. BFS traversal from startUrl, bounded by maxPages/maxDepth/concurrency
       for each page:
         - safeFetch()                       → FetchResult (SSRF-protected)
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

## Sitemap discovery (`sitemap.ts`)

Parses `<urlset>` (a leaf sitemap) and `<sitemapindex>` (an index of sitemaps). Sitemap URLs are
recorded (`CrawlResult.sitemapUrls`) but **not** currently used to seed the crawl traversal itself
— traversal happens via discovered page links. A later phase may use sitemap URLs to flag
indexable-but-unreached pages (a Phase 07 audit-engine concern, not a crawler one).

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

## Known limitations (tracked, not silently accepted)

- No JS rendering fallback yet (see above).
- Sitemap URLs are discovered and recorded but not yet cross-referenced against what the crawl
  actually reached — useful for a future "sitemap contains non-indexable URL" audit rule.
- No per-host rate limiting beyond the global `concurrency` cap — fine for auditing a single site
  per crawl (the only mode this release supports), would need revisiting for multi-site
  concurrent crawls sharing infrastructure.
