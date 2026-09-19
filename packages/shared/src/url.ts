/**
 * Normalizes a URL for deduplication purposes during crawling:
 * lowercases the host, strips the fragment, removes default ports,
 * removes a trailing slash on the path (except root), and sorts query params.
 */
export function normalizeUrl(rawUrl: string, base?: string): string {
  const url = new URL(rawUrl, base);

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.protocol = url.protocol.toLowerCase();

  if (
    (url.protocol === "http:" && url.port === "80") ||
    (url.protocol === "https:" && url.port === "443")
  ) {
    url.port = "";
  }

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }

  const params = new URLSearchParams(url.search);
  const sorted = new URLSearchParams();
  [...params.keys()].sort().forEach((key) => {
    for (const value of params.getAll(key)) {
      sorted.append(key, value);
    }
  });
  url.search = sorted.toString();

  return url.toString();
}

export function isSameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

export function isValidHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
