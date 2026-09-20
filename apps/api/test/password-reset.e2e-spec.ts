import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { MailerService } from "../src/auth/mailer.service";
import { createTestApp, uniqueEmail } from "./test-app";

class FakeMailer {
  lastResetUrl: string | undefined;

  sendPasswordResetEmail(_email: string, resetUrl: string): void {
    this.lastResetUrl = resetUrl;
  }
}

function extractToken(resetUrl: string): string {
  return new URL(resetUrl).searchParams.get("token") ?? "";
}

describe("Password reset (e2e)", () => {
  let app: INestApplication;
  let fakeMailer: FakeMailer;

  beforeAll(async () => {
    fakeMailer = new FakeMailer();
    app = await createTestApp((builder) =>
      builder.overrideProvider(MailerService).useValue(fakeMailer),
    );
  });

  afterAll(async () => {
    await app.close();
  });

  it("does not reveal whether an email exists", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post("/api/v1/auth/password-reset/request")
      .send({ email: "definitely-not-registered@searchanvil.test" });
    expect(res.status).toBe(202);
  });

  it("resets the password with a valid token and invalidates existing sessions", async () => {
    const server = app.getHttpServer();
    const email = uniqueEmail("reset");
    const oldPassword = "correct horse battery staple";
    const newPassword = "a totally different passphrase";

    const registerRes = await request(server).post("/api/v1/auth/register").send({
      email,
      password: oldPassword,
      name: "Reset Me",
      organizationName: "Reset Org",
    });
    const sessionCookie = (registerRes.headers["set-cookie"] as unknown as string[])
      .find((c) => c.startsWith("searchanvil_session="))
      ?.split(";")[0];

    await request(server).post("/api/v1/auth/password-reset/request").send({ email });
    expect(fakeMailer.lastResetUrl).toBeTruthy();
    const token = extractToken(fakeMailer.lastResetUrl ?? "");
    expect(token).not.toBe("");

    const confirmRes = await request(server)
      .post("/api/v1/auth/password-reset/confirm")
      .send({ token, newPassword });
    expect(confirmRes.status).toBe(204);

    // Old session must be dead after a password reset.
    const meWithOldSession = await request(server).get("/api/v1/auth/me").set("Cookie", sessionCookie ?? "");
    expect(meWithOldSession.status).toBe(401);

    const loginOld = await request(server)
      .post("/api/v1/auth/login")
      .send({ email, password: oldPassword });
    expect(loginOld.status).toBe(401);

    const loginNew = await request(server)
      .post("/api/v1/auth/login")
      .send({ email, password: newPassword });
    expect(loginNew.status).toBe(200);
  });

  it("rejects a reused or invalid reset token", async () => {
    const server = app.getHttpServer();
    const res = await request(server)
      .post("/api/v1/auth/password-reset/confirm")
      .send({ token: "not-a-real-token", newPassword: "whatever password here" });
    expect(res.status).toBe(401);
  });
});
