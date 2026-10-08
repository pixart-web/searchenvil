/**
 * Lightweight client-side email check shared by the launch-list form. The
 * API (class-validator's @IsEmail on CreateLaunchListSignupDto) remains the
 * source of truth for validation — this only avoids an obviously-invalid
 * round trip and gives an immediate, accessible inline error.
 */
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}
