export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string | undefined;
  password: string | undefined;
  fromAddress: string;
  fromName: string;
}

/**
 * Reads SMTP configuration from the environment. Returns `undefined` when
 * `SMTP_HOST` isn't set — the caller (auth.module.ts) then falls back to
 * `ConsoleMailTransport`, so a deployment without SMTP configured degrades
 * gracefully (password reset still works structurally, just doesn't send a
 * real email) rather than crashing at startup. Throws with a clear message
 * if `SMTP_HOST` *is* set but the configuration is otherwise incomplete or
 * invalid — a half-configured production mail transport should fail loudly
 * at startup, not silently drop emails.
 */
export function readSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig | undefined {
  const host = env.SMTP_HOST?.trim();
  if (!host) {
    return undefined;
  }

  const portRaw = env.SMTP_PORT?.trim();
  const port = portRaw ? Number(portRaw) : 587;
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid SMTP_PORT: "${portRaw}" — must be an integer between 1 and 65535.`);
  }

  const fromAddress = env.MAIL_FROM_ADDRESS?.trim();
  if (!fromAddress) {
    throw new Error("SMTP_HOST is set but MAIL_FROM_ADDRESS is missing — a sender address is required.");
  }

  return {
    host,
    port,
    secure: env.SMTP_SECURE?.trim().toLowerCase() === "true",
    user: env.SMTP_USER?.trim() || undefined,
    password: env.SMTP_PASSWORD?.trim() || undefined,
    fromAddress,
    fromName: env.MAIL_FROM_NAME?.trim() || "SearchAnvil",
  };
}
