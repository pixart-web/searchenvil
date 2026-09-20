import { Agent, request } from "undici";
import { isValidHttpUrl } from "@searchanvil/shared";
import { createSafeLookup, isBlockedAddress, SsrfBlockedError } from "./ssrf";
import type { FetchResult } from "./types";

const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 10 * 1024 * 1024; // 10 MB — plenty for HTML, guards against a runaway response.

let sharedAgent: Agent | undefined;

/**
 * A single undici Agent, shared across requests, configured to resolve DNS
 * through the SSRF-safe lookup (see ssrf.ts) for every connection it makes —
 * including ones made internally while following a redirect, since we
 * disable undici's own redirect handling and follow hops manually below.
 */
function getAgent(): Agent {
  if (!sharedAgent) {
    sharedAgent = new Agent({ connect: { lookup: createSafeLookup() } });
  }
  return sharedAgent;
}

function isLiteralBlockedIp(hostname: string): boolean {
  // Strip brackets from a literal IPv6 host ("[::1]" -> "::1").
  const bare = hostname.startsWith("[") && hostname.endsWith("]") ? hostname.slice(1, -1) : hostname;
  return /^[\d.]+$|^[\da-f:]+$/i.test(bare) && isBlockedAddress(bare);
}

export interface FetchOptions {
  userAgent: string;
  timeoutMs: number;
  /**
   * Overrides the SSRF-safe shared Agent. Production code should never pass
   * this — it exists so tests can point at a local fixture server (which is
   * necessarily on a loopback address the safe Agent would otherwise, and
   * correctly, refuse to connect to).
   */
  dispatcher?: Agent;
  /**
   * Propagated from the crawl's AbortController (see runCrawl's
   * RunCrawlOptions.signal) all the way down to undici's request() call, so
   * cancellation actually aborts an in-flight request instead of only
   * preventing new ones from starting.
   */
  signal?: AbortSignal;
}

/**
 * Fetches a URL with SSRF protection (DNS-resolved-IP validation on every
 * hop, via the Agent's custom lookup) and manual, bounded redirect
 * following (each hop is itself a fresh validated request — an attacker
 * can't use a 200 response from a public host to redirect to an internal
 * one). Never throws for an ordinary fetch failure — errors are reported in
 * the returned FetchResult so a crawl can record a failed page as a fact,
 * not crash the run.
 */
export async function safeFetch(url: string, options: FetchOptions): Promise<FetchResult> {
  const redirectChain: string[] = [];
  let currentUrl = url;
  const startedAt = Date.now();

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!isValidHttpUrl(currentUrl)) {
      return failure(url, redirectChain, startedAt, `Invalid URL: ${currentUrl}`);
    }

    const parsed = new URL(currentUrl);
    if (!options.dispatcher && isLiteralBlockedIp(parsed.hostname)) {
      return failure(
        url,
        redirectChain,
        startedAt,
        `Refusing to fetch ${currentUrl}: literal IP is not a public address.`,
      );
    }

    try {
      const response = await request(currentUrl, {
        method: "GET",
        dispatcher: options.dispatcher ?? getAgent(),
        headers: { "user-agent": options.userAgent },
        headersTimeout: options.timeoutMs,
        bodyTimeout: options.timeoutMs,
        signal: options.signal,
      });

      const status = response.statusCode;
      const location = firstHeader(response.headers.location);
      if (status >= 300 && status < 400 && location) {
        await response.body.dump();
        const nextUrl = new URL(location, currentUrl).toString();
        redirectChain.push(currentUrl);
        currentUrl = nextUrl;
        continue;
      }

      const body = await readBodyBounded(response.body, MAX_RESPONSE_BYTES);
      const contentType = firstHeader(response.headers["content-type"]);

      return {
        requestedUrl: url,
        finalUrl: currentUrl,
        redirectChain,
        statusCode: status,
        contentType,
        xRobotsTag: firstHeader(response.headers["x-robots-tag"]),
        responseTimeMs: Date.now() - startedAt,
        htmlSizeBytes: body ? Buffer.byteLength(body) : undefined,
        body,
        fetchError: undefined,
      };
    } catch (error) {
      if (error instanceof SsrfBlockedError) {
        return failure(url, redirectChain, startedAt, error.message);
      }
      return failure(
        url,
        redirectChain,
        startedAt,
        error instanceof Error ? error.message : "Unknown fetch error",
      );
    }
  }

  return failure(url, redirectChain, startedAt, "Too many redirects.");
}

function firstHeader(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

async function readBodyBounded(
  body: AsyncIterable<Uint8Array>,
  maxBytes: number,
): Promise<string | undefined> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of body) {
    total += chunk.byteLength;
    if (total > maxBytes) {
      return undefined;
    }
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function failure(
  requestedUrl: string,
  redirectChain: string[],
  startedAt: number,
  message: string,
): FetchResult {
  return {
    requestedUrl,
    finalUrl: redirectChain.at(-1) ?? requestedUrl,
    redirectChain,
    statusCode: undefined,
    contentType: undefined,
    xRobotsTag: undefined,
    responseTimeMs: Date.now() - startedAt,
    htmlSizeBytes: undefined,
    body: undefined,
    fetchError: message,
  };
}
