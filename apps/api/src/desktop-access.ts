import { timingSafeEqual } from "node:crypto";
import type { RequestHandler } from "express";

export interface DesktopAccess {
  hostname: "127.0.0.1";
  middleware: RequestHandler;
}

/**
 * The desktop supervisor supplies a new 256-bit capability on every launch.
 * Fail closed before installing any public or authenticated application routes.
 */
export function desktopAccess(env: NodeJS.ProcessEnv, apiPort: number): DesktopAccess | undefined {
  const capability = env.SEARCHANVIL_DESKTOP_CAPABILITY;
  if (capability === undefined) return undefined;

  const webOrigin = new URL(env.WEB_URL ?? "");
  if (
    !/^[a-f0-9]{64}$/.test(capability) ||
    webOrigin.protocol !== "http:" ||
    webOrigin.hostname !== "127.0.0.1" ||
    !webOrigin.port ||
    webOrigin.origin !== env.WEB_URL ||
    !Number.isInteger(apiPort) ||
    apiPort < 1024 ||
    apiPort > 65535
  ) {
    throw new Error("Invalid SearchAnvil desktop API configuration");
  }

  const expected = Buffer.from(capability, "ascii");
  return {
    hostname: "127.0.0.1",
    middleware(request, response, next) {
      const token = request.get("x-searchanvil-desktop-capability") ?? "";
      const origin = request.get("origin");
      if (
        request.get("host") !== `127.0.0.1:${apiPort}` ||
        (origin !== undefined && origin !== webOrigin.origin) ||
        !/^[a-f0-9]{64}$/.test(token) ||
        !timingSafeEqual(expected, Buffer.from(token, "ascii"))
      ) {
        response.sendStatus(403);
        return;
      }
      next();
    },
  };
}
