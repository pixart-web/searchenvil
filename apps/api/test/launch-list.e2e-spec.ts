import { afterEach, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { prisma } from "@searchanvil/database";
import { createTestApp, uniqueEmail } from "./test-app";

// Each test gets its own Nest app instance (and therefore its own
// in-memory ThrottlerStorage), since /launch-list is deliberately
// throttled tightly (5/min/IP — see launch-list.controller.ts) and a
// shared instance across tests would make unrelated assertions flaky
// depending on how many requests earlier tests happened to make.
describe("LaunchList (e2e)", () => {
  let app: INestApplication | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("accepts an unauthenticated signup and persists it", async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    const email = uniqueEmail("launch");

    const res = await request(server).post("/api/v1/launch-list").send({
      email,
      name: "Ada Lovelace",
      company: "Analytical Engines Ltd",
      role: "SEO Lead",
      source: "homepage-hero",
    });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "confirmed" });

    const stored = await prisma.launchListSignup.findUnique({ where: { email: email.toLowerCase() } });
    expect(stored).not.toBeNull();
    expect(stored?.name).toBe("Ada Lovelace");
    expect(stored?.source).toBe("homepage-hero");
  });

  it("normalizes email casing and dedupes without leaking existence", async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    const email = uniqueEmail("dedup");

    const first = await request(server).post("/api/v1/launch-list").send({ email: email.toUpperCase() });
    expect(first.status).toBe(200);

    const second = await request(server).post("/api/v1/launch-list").send({ email });
    // Idempotent success — a repeat signup must not error or reveal that the
    // address already exists.
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ status: "confirmed" });

    const rows = await prisma.launchListSignup.findMany({ where: { email: email.toLowerCase() } });
    expect(rows).toHaveLength(1);
  });

  it("rejects a malformed email with a 400 and no leaked stack trace", async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    const res = await request(server).post("/api/v1/launch-list").send({ email: "not-an-email" });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.message).not.toMatch(/at\s+\S+\s+\(.*\.ts:\d+/);
  });

  it("rejects an unknown field (no whitelist bypass)", async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    const res = await request(server).post("/api/v1/launch-list").send({ notAField: "x" });

    expect(res.status).toBe(400);
  });

  it("silently discards a submission with the honeypot field filled, without persisting it", async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    const email = uniqueEmail("bot");

    const res = await request(server)
      .post("/api/v1/launch-list")
      .send({ email, website: "https://spam.example/casino" });

    // Looks like success to the bot...
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "confirmed" });

    // ...but nothing was actually written.
    const stored = await prisma.launchListSignup.findUnique({ where: { email: email.toLowerCase() } });
    expect(stored).toBeNull();
  });

  it("throttles rapid repeated submissions from the same client", async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    const statuses: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      const res = await request(server)
        .post("/api/v1/launch-list")
        .send({ email: uniqueEmail(`throttle-${i}`) });
      statuses.push(res.status);
    }

    expect(statuses.some((s) => s === 429)).toBe(true);
  });
});
