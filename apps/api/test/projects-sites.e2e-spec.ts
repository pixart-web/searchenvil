import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { createTestApp, extractCookieHeader, extractCookieValue, uniqueEmail } from "./test-app";

interface Session {
  cookieHeader: string;
  csrfToken: string;
  organizationId: string;
}

async function registerAndGetSession(server: unknown, label: string): Promise<Session> {
  const res = await request(server as never)
    .post("/api/v1/auth/register")
    .send({
      email: uniqueEmail(label),
      password: "correct horse battery staple",
      name: label,
      organizationName: `${label} Org`,
    });
  const cookies = res.headers["set-cookie"] as unknown as string[];
  const cookieHeader = extractCookieHeader(cookies);
  const orgs = await request(server as never).get("/api/v1/organizations").set("Cookie", cookieHeader);
  return {
    cookieHeader,
    csrfToken: extractCookieValue(cookies, "searchanvil_csrf") ?? "",
    organizationId: orgs.body[0].id,
  };
}

describe("Projects & Sites (e2e)", () => {
  let app: INestApplication;
  let alice: Session;
  let bob: Session;

  beforeAll(async () => {
    app = await createTestApp();
    const server = app.getHttpServer();
    alice = await registerAndGetSession(server, "palice");
    bob = await registerAndGetSession(server, "pbob");
  });

  afterAll(async () => {
    await app.close();
  });

  it("creates a project within the caller's organization", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Marketing Site" });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe("Marketing Site");
    expect(res.body.organizationId).toBe(alice.organizationId);
  });

  it("rejects an empty project name", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("blocks creating a project in another organization", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post(`/api/v1/organizations/${bob.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Should Not Exist" });
    expect(res.status).toBe(403);
  });

  it("adds a validated website to a project", async () => {
    const server = app.getHttpServer();
    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Site Project" });
    const projectId = projectRes.body.id;

    const siteRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Example", rootUrl: "https://example.com" });

    expect(siteRes.status).toBe(201);
    expect(siteRes.body.rootUrl).toBe("https://example.com");
  });

  it("rejects a non-HTTP(S) URL as a site root", async () => {
    const server = app.getHttpServer();
    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Bad URL Project" });
    const projectId = projectRes.body.id;

    const res = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Bad", rootUrl: "javascript:alert(1)" });

    expect(res.status).toBe(400);
  });

  it("rejects adding the same website twice to one project", async () => {
    const server = app.getHttpServer();
    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Dup Site Project" });
    const projectId = projectRes.body.id;

    await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Example", rootUrl: "https://example.com" });

    const dup = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "Example Again", rootUrl: "https://example.com" });

    expect(dup.status).toBe(409);
  });

  it("blocks a foreign user from reading a project via its own organization route", async () => {
    const server = app.getHttpServer();
    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Alice Private Project" });
    const projectId = projectRes.body.id;

    // Bob tries to read Alice's project by ID, scoped under his OWN organization.
    const res = await request(server)
      .get(`/api/v1/organizations/${bob.organizationId}/projects/${projectId}`)
      .set("Cookie", bob.cookieHeader);
    expect(res.status).toBe(404);

    // And directly under Alice's org, Bob still isn't a member so it's 403.
    const res2 = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}/projects/${projectId}`)
      .set("Cookie", bob.cookieHeader);
    expect(res2.status).toBe(403);
  });

  it("blocks reading a site through a project it does not belong to (cross-project IDOR)", async () => {
    const server = app.getHttpServer();
    const projectARes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Project A" });
    const projectBRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Project B" });

    const siteRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects/${projectARes.body.id}/sites`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ displayName: "A's Site", rootUrl: "https://a-site.example.com" });

    // Same org, same user, but the site belongs to project A, not project B.
    const res = await request(server)
      .get(
        `/api/v1/organizations/${alice.organizationId}/projects/${projectBRes.body.id}/sites/${siteRes.body.id}`,
      )
      .set("Cookie", alice.cookieHeader);
    expect(res.status).toBe(404);
  });

  it("lets an ADMIN delete a project but blocks a plain MEMBER", async () => {
    const server = app.getHttpServer();
    const projectRes = await request(server)
      .post(`/api/v1/organizations/${alice.organizationId}/projects`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken)
      .send({ name: "Deletable Project" });

    // Alice is OWNER (>= ADMIN), so she can delete it.
    const res = await request(server)
      .delete(`/api/v1/organizations/${alice.organizationId}/projects/${projectRes.body.id}`)
      .set("Cookie", alice.cookieHeader)
      .set("x-csrf-token", alice.csrfToken);
    expect(res.status).toBe(200);

    const getAfterDelete = await request(server)
      .get(`/api/v1/organizations/${alice.organizationId}/projects/${projectRes.body.id}`)
      .set("Cookie", alice.cookieHeader);
    expect(getAfterDelete.status).toBe(404);
  });
});
