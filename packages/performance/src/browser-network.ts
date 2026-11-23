import http, { type IncomingHttpHeaders, type IncomingMessage } from "node:http";
import net, { type Socket } from "node:net";
import { createSafeLookup, isBlockedAddress } from "@searchanvil/crawler";

const lookup = createSafeLookup();

function getTarget(raw: string, tunnel: boolean): URL | undefined {
  let target: URL;
  try {
    target = new URL(tunnel ? `https://${raw}` : raw);
  } catch {
    return undefined;
  }
  if (
    target.protocol !== (tunnel ? "https:" : "http:") ||
    target.username ||
    target.password ||
    (tunnel && (target.pathname !== "/" || target.search || target.hash))
  ) {
    return undefined;
  }
  const host = hostname(target);
  if (net.isIP(host) && isBlockedAddress(host)) return undefined;
  return target;
}

function hostname(target: URL): string {
  return target.hostname.replace(/^\[|\]$/g, "");
}

function headersWithoutHopByHop(headers: IncomingHttpHeaders): IncomingHttpHeaders {
  const result = { ...headers };
  const connectionHeaders = (headers.connection ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase());
  for (const name of [
    ...connectionHeaders,
    "connection",
    "proxy-connection",
    "keep-alive",
    "transfer-encoding",
    "upgrade",
    "te",
    "trailer",
    "proxy-authorization",
    "proxy-authenticate",
  ]) {
    delete result[name];
  }
  return result;
}

/** A fresh browser has only this HTTP(S) egress path. DNS is checked by the
 * socket's lookup function for every destination, including redirected or
 * embedded resources. CONNECT preserves Chromium's end-to-end TLS validation.
 */
export async function createBrowserNetwork(timeoutMs: number): Promise<{
  server: string;
  close: () => Promise<void>;
}> {
  const sockets = new Set<Socket>();
  const track = (socket: Socket): void => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
    socket.on("error", () => socket.destroy());
    socket.setTimeout(timeoutMs, () => socket.destroy());
  };

  const proxy = http.createServer((request, response) => {
    const target = getTarget(request.url ?? "", false);
    if (!target) {
      response.writeHead(403, { "x-searchanvil-egress-blocked": "1" }).end();
      return;
    }
    const outgoing = http.request(
      {
        hostname: hostname(target),
        port: target.port || 80,
        path: target.pathname + target.search,
        method: request.method,
        headers: { ...headersWithoutHopByHop(request.headers), host: target.host },
        lookup,
        agent: false,
      },
      (result) => {
        response.writeHead(result.statusCode ?? 502, headersWithoutHopByHop(result.headers));
        result.on("error", () => response.destroy());
        result.pipe(response);
      },
    );
    outgoing.setTimeout(timeoutMs, () => outgoing.destroy());
    outgoing.on("error", () => {
      if (response.headersSent) response.destroy();
      else response.writeHead(502, { "x-searchanvil-egress-blocked": "1" }).end();
    });
    response.on("close", () => outgoing.destroy());
    request.pipe(outgoing);
  });

  proxy.on("connection", track);
  proxy.on("connect", (request: IncomingMessage, socket: Socket, head: Buffer) => {
    const target = getTarget(request.url ?? "", true);
    if (!target) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    const destination = net.connect({
      host: hostname(target),
      port: Number(target.port || 443),
      lookup,
    });
    track(destination);
    socket.on("close", () => destination.destroy());
    destination.on("close", () => socket.destroy());
    destination.once("connect", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      if (head.length > 0) destination.write(head);
      socket.pipe(destination).pipe(socket);
    });
  });

  const address = await new Promise<net.AddressInfo>((resolve, reject) => {
    proxy.once("error", reject);
    proxy.listen(0, "127.0.0.1", () => resolve(proxy.address() as net.AddressInfo));
  });

  return {
    server: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve) => {
        proxy.close(() => resolve());
        for (const socket of sockets) socket.destroy();
      }),
  };
}
