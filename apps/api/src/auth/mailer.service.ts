import { Injectable, Logger } from "@nestjs/common";

/**
 * Placeholder transactional email sender. Logs instead of sending so the
 * password-reset flow is fully exercised (token issuance, expiry, one-time
 * use) without depending on a real provider. Swapping this for SES/Postmark/
 * etc. before production is a release-checklist item — see docs/SECURITY.md
 * and docs/RELEASE_CHECKLIST.md.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger("Mailer");

  sendPasswordResetEmail(email: string, resetUrl: string): void {
    this.logger.log(`[dev-stub] Password reset for ${email}: ${resetUrl}`);
  }
}
