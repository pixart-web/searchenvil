import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

export interface FixtureRoute {
  status?: number;
  headers?: Record<string, string>;
  body?: string;
}

export interface FixtureServer {
  url: string;
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
      res.writeHead(route.status ?? 200, {
        "content-type": "text/html; charset=utf-8",
        ...route.headers,
      });
      res.end(route.body ?? "");
    });

    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise((res) => server.close(() => res())),
      });
    });
  });
}
