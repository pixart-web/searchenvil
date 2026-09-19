import { createHash, randomBytes } from "node:crypto";

/**
 * Session tokens are high-entropy random values, so a fast hash (SHA-256) is
 * appropriate for the lookup index — unlike passwords, there's no offline
 * brute-force risk worth paying scrypt's cost for. The raw token only ever
 * lives in the client's cookie; the database stores just the hash.
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateCsrfToken(): string {
  return randomBytes(24).toString("base64url");
}
