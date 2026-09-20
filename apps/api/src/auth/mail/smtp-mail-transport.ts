import { createTransport, type Transporter } from "nodemailer";
import type { MailMessage, MailTransport } from "./mail-transport.interface";
import type { SmtpConfig } from "./mail-config";

/**
 * Real production email delivery via SMTP (nodemailer). Configuration comes
 * entirely from environment variables (see readSmtpConfig/.env.example) —
 * never hard-coded credentials. Used only when SMTP_HOST is set; see
 * auth.module.ts for the selection logic.
 */
export class SmtpMailTransport implements MailTransport {
  private readonly transporter: Transporter;
  private readonly fromAddress: string;
  private readonly fromName: string;

  constructor(config: SmtpConfig) {
    this.transporter = createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user && config.password ? { user: config.user, pass: config.password } : undefined,
    });
    this.fromAddress = config.fromAddress;
    this.fromName = config.fromName;
  }

  async send(message: MailMessage): Promise<void> {
    await this.transporter.sendMail({
      from: `"${this.fromName}" <${this.fromAddress}>`,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
