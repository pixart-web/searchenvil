import { describe, expect, it } from "vitest";
import { readSmtpConfig } from "./mail-config";

describe("readSmtpConfig", () => {
  it("returns undefined when SMTP_HOST is not set (deterministic dev/test default)", () => {
    expect(readSmtpConfig({})).toBeUndefined();
  });

  it("returns undefined when SMTP_HOST is blank", () => {
    expect(readSmtpConfig({ SMTP_HOST: "   " })).toBeUndefined();
  });

  it("builds a valid config from a complete environment", () => {
    const config = readSmtpConfig({
      SMTP_HOST: "smtp.example.com",
      SMTP_PORT: "465",
      SMTP_SECURE: "true",
      SMTP_USER: "apikey",
      SMTP_PASSWORD: "secret",
      MAIL_FROM_ADDRESS: "noreply@searchanvil.test",
      MAIL_FROM_NAME: "SearchAnvil Alerts",
    });
    expect(config).toEqual({
      host: "smtp.example.com",
      port: 465,
      secure: true,
      user: "apikey",
      password: "secret",
      fromAddress: "noreply@searchanvil.test",
      fromName: "SearchAnvil Alerts",
    });
  });

  it("defaults port to 587, secure to false, and fromName to SearchAnvil", () => {
    const config = readSmtpConfig({
      SMTP_HOST: "smtp.example.com",
      MAIL_FROM_ADDRESS: "noreply@searchanvil.test",
    });
    expect(config?.port).toBe(587);
    expect(config?.secure).toBe(false);
    expect(config?.fromName).toBe("SearchAnvil");
    expect(config?.user).toBeUndefined();
  });

  it("throws when SMTP_HOST is set but MAIL_FROM_ADDRESS is missing", () => {
    expect(() => readSmtpConfig({ SMTP_HOST: "smtp.example.com" })).toThrow(/MAIL_FROM_ADDRESS/);
  });

  it("throws on a non-numeric SMTP_PORT", () => {
    expect(() =>
      readSmtpConfig({
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "not-a-port",
        MAIL_FROM_ADDRESS: "noreply@searchanvil.test",
      }),
    ).toThrow(/Invalid SMTP_PORT/);
  });

  it("throws on an out-of-range SMTP_PORT", () => {
    expect(() =>
      readSmtpConfig({
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "70000",
        MAIL_FROM_ADDRESS: "noreply@searchanvil.test",
      }),
    ).toThrow(/Invalid SMTP_PORT/);
  });
});
