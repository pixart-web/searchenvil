import { Logger, Module } from "@nestjs/common";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { MailerService } from "./mailer.service";
import { SessionAuthGuard } from "./guards/session-auth.guard";
import { OrgRolesGuard } from "./guards/org-roles.guard";
import { MAIL_TRANSPORT } from "./mail/mail.tokens";
import { ConsoleMailTransport } from "./mail/console-mail-transport";
import { SmtpMailTransport } from "./mail/smtp-mail-transport";
import { readSmtpConfig } from "./mail/mail-config";
import type { MailTransport } from "./mail/mail-transport.interface";

const moduleLogger = new Logger("AuthModule");

/**
 * SMTP is opt-in: set SMTP_HOST to send real email via SmtpMailTransport;
 * leave it unset (the default for local dev and CI) to use
 * ConsoleMailTransport, which never makes a network call. See
 * docs/OPERATIONS.md and .env.example.
 */
function createMailTransport(): MailTransport {
  const smtpConfig = readSmtpConfig();
  if (!smtpConfig) {
    moduleLogger.warn("SMTP_HOST is not set — password reset emails will be logged, not sent.");
    return new ConsoleMailTransport();
  }
  moduleLogger.log(`Using SMTP transport (${smtpConfig.host}:${smtpConfig.port}) for outbound email.`);
  return new SmtpMailTransport(smtpConfig);
}

@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    MailerService,
    SessionAuthGuard,
    OrgRolesGuard,
    { provide: MAIL_TRANSPORT, useFactory: createMailTransport },
  ],
  exports: [AuthService, SessionAuthGuard, OrgRolesGuard],
})
export class AuthModule {}
