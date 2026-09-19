import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, extractCookieHeader, extractCookieValue, uniqueEmail } from "./test-app";

describe("Auth (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it("rejects unauthenticated access to a protected route", async () => {
    const server = app.getHttpServer();
    const res = await request(server).get("/api/v1/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(res.body.error.requestId).toBeTruthy();
  });

  it("registers a new user, creates an org, and returns a session cookie", async () => {
    const server = app.getHttpServer();
    const email = uniqueEmail("register");

    const res = await request(server).post("/api/v1/auth/register").send({
      email,
      password: "correct horse battery staple",
      name: "Test User",
      organizationName: "Test Org",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers["set-cookie"]).toBeTruthy();
  });

  it("rejects registration with a duplicate email", async () => {
    const server = app.getHttpServer();
    const email = uniqueEmail("dup");

    await request(server).post("/api/v1/auth/register").send({
      email,
      password: "correct horse battery staple",
      name: "Test User",
      organizationName: "Test Org",
    });

    const res = await request(server).post("/api/v1/auth/register").send({
      email,
      password: "another password entirely",
      name: "Test User 2",
      organizationName: "Another Org",
    });

    expect(res.status).toBe(409);
  });

  it("logs in with correct credentials and rejects incorrect ones", async () => {
    const server = app.getHttpServer();
    const email = uniqueEmail("login");
    const password = "correct horse battery staple";

    await request(server).post("/api/v1/auth/register").send({
      email,
      password,
      name: "Test User",
      organizationName: "Test Org",
    });

    const good = await request(server).post("/api/v1/auth/login").send({ email, password });
    expect(good.status).toBe(200);

    const bad = await request(server)
      .post("/api/v1/auth/login")
      .send({ email, password: "wrong password" });
    expect(bad.status).toBe(401);
  });

  it("lets a session cookie access /auth/me and logout invalidates it", async () => {
    const server = app.getHttpServer();
    const email = uniqueEmail("me");
    const password = "correct horse battery staple";

    const registerRes = await request(server).post("/api/v1/auth/register").send({
      email,
      password,
      name: "Test User",
      organizationName: "Test Org",
    });
    const setCookies = registerRes.headers["set-cookie"] as unknown as string[];
    const cookieHeader = extractCookieHeader(setCookies);
    const csrfToken = extractCookieValue(setCookies, "searchenvil_csrf");

    const meRes = await request(server).get("/api/v1/auth/me").set("Cookie", cookieHeader);
    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe(email);

    const logoutRes = await request(server)
      .post("/api/v1/auth/logout")
      .set("Cookie", cookieHeader)
      .set("x-csrf-token", csrfToken ?? "");
    expect(logoutRes.status).toBe(204);

    const meAfterLogout = await request(server).get("/api/v1/auth/me").set("Cookie", cookieHeader);
    expect(meAfterLogout.status).toBe(401);
  });

  it("rejects a mutating request with a valid session but missing CSRF token", async () => {
    const server = app.getHttpServer();
    const email = uniqueEmail("csrf");
    const password = "correct horse battery staple";

    const registerRes = await request(server).post("/api/v1/auth/register").send({
      email,
      password,
      name: "Test User",
      organizationName: "Test Org",
    });
    const cookieHeader = extractCookieHeader(registerRes.headers["set-cookie"] as unknown as string[]);

    const res = await request(server).post("/api/v1/auth/logout").set("Cookie", cookieHeader);
    expect(res.status).toBe(403);
  });
});
