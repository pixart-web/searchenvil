import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { desktopAccess } from "./desktop-access";

const capability = "ab".repeat(32);
const webOrigin = "http://127.0.0.1:4567";
const apiPort = 4568;
const env = { SEARCHANVIL_DESKTOP_CAPABILITY: capability, WEB_URL: webOrigin };

describe("desktop API access", () => {
  it("leaves the web startup path available", () => {
    expect(desktopAccess({}, apiPort)).toBeUndefined();
  });

  it("fails closed on invalid desktop configuration", () => {
    expect(() => desktopAccess({ ...env, SEARCHANVIL_DESKTOP_CAPABILITY: "" }, apiPort)).toThrow();
    expect(() => desktopAccess({ ...env, WEB_URL: "http://localhost:4567" }, apiPort)).toThrow();
    expect(() => desktopAccess(env, 0)).toThrow();
  });

  it("requires the capability and checks host and origin even on public routes", async () => {
    const access = desktopAccess(env, apiPort)!;
    const app = express();
    app.use(access.middleware);
    app.get("/health", (_req, res) => res.sendStatus(200));
    const health = () => request(app).get("/health").set("Host", `127.0.0.1:${apiPort}`);
    const authenticated = () => health().set("X-SearchAnvil-Desktop-Capability", capability);

    await health().expect(403);
    await health().set("X-SearchAnvil-Desktop-Capability", "cd".repeat(32)).expect(403);
    await authenticated().set("Host", "example.test").expect(403);
    await authenticated().set("Origin", "http://example.test").expect(403);
    await authenticated().set("Origin", webOrigin).expect(200);
    await authenticated().expect(200);
    expect(access.hostname).toBe("127.0.0.1");
  });
});
