import { NextResponse, type NextRequest } from "next/server";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Server-side proxy for the public launch-list signup form. Keeping this as
 * a Next.js route handler (rather than calling the NestJS API directly from
 * the browser) means:
 *  - no CORS configuration needed on the API for a public marketing form,
 *  - the anonymous submission never needs the cookie-based CSRF dance that
 *    `apiFetch` uses for authenticated product requests (see api-client.ts),
 *  - and we have one place to forward the visitor's real IP so the API's
 *    per-IP throttle (see apps/api/src/launch-list/launch-list.controller.ts)
 *    keys on the actual client rather than this server. See
 *    docs/MARKETING_SITE.md ("known limitations") for the caveat that this
 *    still requires the API to trust the forwarded header in production.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_JSON", message: "Malformed request body." } },
      { status: 400 },
    );
  }

  const forwardedFor = request.headers.get("x-forwarded-for") ?? "";

  let upstream: Response;
  try {
    upstream = await fetch(`${API_URL}/api/v1/launch-list`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(forwardedFor ? { "x-forwarded-for": forwardedFor } : {}),
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "UPSTREAM_UNAVAILABLE",
          message: "We couldn't reach the launch list right now. Please try again shortly.",
        },
      },
      { status: 502 },
    );
  }

  const isJson = upstream.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await upstream.json() : undefined;

  return NextResponse.json(data ?? {}, { status: upstream.status });
}
