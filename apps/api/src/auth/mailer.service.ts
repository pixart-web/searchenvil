import { Inject, Injectable } from "@nestjs/common";
import type { MailTransport } from "./mail/mail-transport.interface";
import { MAIL_TRANSPORT } from "./mail/mail.tokens";

/**
 * Builds SearchAnvil-branded transactional email content and hands it to
 * whichever MailTransport is configured (ConsoleMailTransport in dev/test,
 * SmtpMailTransport in production — see auth.module.ts and
 * docs/OPERATIONS.md). Callers never touch a transport directly.
 */
@Injectable()
export class MailerService {
  constructor(@Inject(MAIL_TRANSPORT) private readonly transport: MailTransport) {}

  async sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
    await this.transport.send({
      to: email,
      subject: "Reset your SearchAnvil password",
      text: [
        "SearchAnvil — Forge Better Search Performance.",
        "",
        "We received a request to reset your SearchAnvil password. If you didn't make this",
        "request, you can safely ignore this email — your password hasn't been changed.",
        "",
        `Reset your password: ${resetUrl}`,
        "",
        "This link expires soon and can only be used once.",
      ].join("\n"),
      html: [
        '<div style="font-family: sans-serif; max-width: 480px;">',
        '<p style="letter-spacing: 0.2em; text-transform: uppercase; font-size: 12px; color: #E9A45F;">SearchAnvil</p>',
        "<h1 style=\"font-size: 20px;\">Reset your password</h1>",
        "<p>We received a request to reset your SearchAnvil password. If you didn't make this " +
          "request, you can safely ignore this email — your password hasn't been changed.</p>",
        `<p><a href="${resetUrl}" style="color: #E9A45F;">Reset your password</a></p>`,
        "<p style=\"font-size: 13px; color: #74798C;\">This link expires soon and can only be used once.</p>",
        "</div>",
      ].join(""),
    });
  }
}
