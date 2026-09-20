const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * For the rare case of a direct browser navigation/download link (e.g. a
 * CSV export) instead of a fetch() call — the session cookie rides along
 * automatically on a same-site top-level GET, no apiFetch wrapper needed.
 */
export function apiUrl(path: string): string {
  return `${API_URL}/api/v1${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") {
    return undefined;
  }
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match?.split("=").slice(1).join("=");
}

export interface ApiFetchOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
}

/**
 * Thin fetch wrapper for the SearchAnvil API: sends the session cookie
 * (credentials: "include"), attaches the CSRF header on mutating requests
 * (double-submit pattern — see docs/SECURITY.md), and normalizes error
 * bodies into ApiError.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = {};

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (MUTATING_METHODS.has(method)) {
    const csrfToken = readCookie("searchanvil_csrf");
    if (csrfToken) {
      headers["x-csrf-token"] = csrfToken;
    }
  }

  const res = await fetch(`${API_URL}/api/v1${path}`, {
    method,
    headers,
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const isJson = res.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const errorBody = data?.error;
    throw new ApiError(
      errorBody?.message ?? `Request failed with status ${res.status}`,
      res.status,
      errorBody?.code ?? "UNKNOWN_ERROR",
    );
  }

  return data as T;
}
