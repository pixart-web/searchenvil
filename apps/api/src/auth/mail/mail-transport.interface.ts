export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/**
 * The one thing a mail transport does: send a message. `MailerService`
 * builds the actual (branded) message content; a transport only knows how
 * to deliver it — either nowhere real (ConsoleMailTransport, dev/test) or
 * via real SMTP (SmtpMailTransport, production). See docs/OPERATIONS.md.
 */
export interface MailTransport {
  send(message: MailMessage): Promise<void>;
}
