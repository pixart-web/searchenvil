import { Logger } from "@nestjs/common";
import type { MailMessage, MailTransport } from "./mail-transport.interface";

/**
 * The default transport whenever SMTP isn't configured (local dev, tests,
 * or an environment that simply hasn't set up outbound email yet). Never
 * makes a network call — deterministic, side-effect-free beyond a log line
 * — so the password-reset flow (token issuance, expiry, single-use) is
 * fully exercisable without depending on a real mail provider. Constructed
 * directly (not resolved via Nest's DI container) by auth.module.ts's
 * createMailTransport() factory.
 */
export class ConsoleMailTransport implements MailTransport {
  private readonly logger = new Logger("Mailer");

  async send(message: MailMessage): Promise<void> {
    this.logger.log(`[console transport — no SMTP configured] To: ${message.to} | Subject: ${message.subject}`);
    this.logger.debug(message.text);
  }
}
