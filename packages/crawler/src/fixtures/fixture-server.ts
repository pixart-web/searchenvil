import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface FixtureRoute {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
  /** Delay before responding, in ms — for tests that need to catch a request mid-flight (e.g. cancellation). */
  delayMs?: number;
}

export interface FixtureServer {
  url: string;
  /**
   * The live routes object — mutate it (e.g. `fixture.routes["/sitemap.xml"] = {...}`) to add or
   * change routes after the server has started, once `fixture.url` is known. Useful for a route
   * whose body needs to self-reference the server's own (only-known-after-listen) origin.
   */
  routes: Record<string, FixtureRoute>;
  close: () => Promise<void>;
}

/**
 * A minimal, deterministic HTTP server for crawler tests — no dependency on
 * any real/public website (see docs/TESTING.md).
 */
export function startFixtureServer(routes: Record<string, FixtureRoute>): Promise<FixtureServer> {
  return new Promise((resolve, reject) => {
    const server: Server = createServer((req, res) => {
      const route = routes[req.url ?? "/"];
      if (!route) {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("Not Found");
        return;
      }
      const respond = (): void => {
        res.writeHead(route.status ?? 200, {
          "content-type": "text/html; charset=utf-8",
          ...route.headers,
        });
        res.end(route.body ?? "");
      };
      if (route.delayMs) {
        setTimeout(respond, route.delayMs);
      } else {
        respond();
      }
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        routes,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
