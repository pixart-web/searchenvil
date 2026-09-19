import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, extractCookieHeader, extractCookieValue, uniqueEmail } from "./test-app";

interface Session {
  cookieHeader: string;
  csrfToken: string;
  organizationId: string;
}

describe("Organizations — tenant isolation (e2e)", () => {
  let app: INestApplication;
  let alice: Session;
  let bob: Session;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();

    const aliceRes = await request(server).post("/api/v1/auth/register").send({
      email: uniqueEmail("alice"),
      password: "correct horse battery staple",
      name: "Alice",
      organizationName: "Alice Org",
    });
    const aliceCookies = aliceRes.headers["set-cookie"] as unknown as string[];
    const aliceOrgs = await request(server)
      .get("/api/v1/organizations")
      .set("Cookie", extractCookieHeader(aliceCookies));
    alice = {
      cookieHeader: extractCookieHeader(aliceCookies),
      csrfToken: extractCookieValue(aliceCookies, "searchenvil_csrf") ?? "",
      organizationId: aliceOrgs.body[0].id,
    };

    const bobRes = await request(server).post("/api/v1/auth/register").send({
      email: uniqueEmail("bob"),
      password: "correct horse battery staple",
      name: "Bob",
      organizationName: "Bob Org",
    });
    const bobCookies = bobRes.headers["set-cookie"] as unknown as string[];
    const bobOrgs = await request(server)
      .get("/api/v1/organizations")
      .set("Cookie", extractCookieHeader(bobCookies));
    bob = {
      cookieHeader: extractCookieHeader(bobCookies),
      csrfToken: extractCookieValue(bobCookies, "searchenvil_csrf") ?? "",
      organizationId: bobOrgs.body[0].id,
    };
  });

  afterAll(async () => {
    await app.close();
  });

  it("lets each user see only their own organization in the list", async () => {
    const server = app.getHttpServer();
    const res = await request(server).get("/api/v1/organizations").set("Cookie", alice.cookieHeader);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(alice.organizationId);
  });

  it("blocks a user from reading another user's organization", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`/api/v1/organizations/${bob.organizationId}`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(403);
  });

  it("blocks a user from listing another organization's members", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get(`/api/v1/organizations/${bob.organizationId}/members`)
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(403);
  });

  it("blocks a non-member from modifying another organization's membership", async () => {
    const server = app.getHttpServer();
    const bobMembers = await request(server)
      .get(`/api/v1/organizations/${bob.organizationId}/members`)
      .set("Cookie", bob.cookieHeader);
    const bobMembershipId = bobMembers.body[0].id;

    const res = await request(server)
      .patch(`/api/v1/organizations/${bob.organizationId}/members/${bobMembershipId}`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ role: "MEMBER" });

    expect(res.status).toBe(403);
  });

  it("blocks access entirely for a fabricated/non-existent organization id", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .get("/api/v1/organizations/00000000-0000-0000-0000-000000000000")
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(403);
  });

  it("allows the owner to read their own organization and members", async () => {
    const server = app.getHttpServer();
    const orgRes = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}`)
      .set("Cookie", alice.cookieHeader);
    expect(orgRes.status).toBe(200);

    const membersRes = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}/members`)
      .set("Cookie", alice.cookieHeader);
    expect(membersRes.status).toBe(200);
    expect(membersRes.body).toHaveLength(1);
    expect(membersRes.body[0].role).toBe("OWNER");
  });

  it("prevents demoting the last remaining OWNER", async () => {
    const server = app.getHttpServer();
    const membersRes = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}/members`)
      .set("Cookie", alice.cookieHeader);
    const ownerMembershipId = membersRes.body[0].id;

    const res = await request(server)
      .patch(`/api/v1/organizations/${alice.organizationId}/members/${ownerMembershipId}`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ role: "ADMIN" });

    expect(res.status).toBe(400);
  });
});
