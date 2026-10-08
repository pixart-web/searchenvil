/**
 * SearchAnvil's logo system: a simplified rounded-square copper mark (an
 * anvil silhouette on a solid copper badge, matching the approved reference
 * mockup's compact header icon) and a wordmark set in the display face.
 * Everything renders as inline SVG/DOM so it's crisp at any size, themeable
 * via `tone`, and reusable for the favicon (see src/app/icon.tsx) and OG
 * image (src/app/opengraph-image.tsx) without shipping a raster asset.
 *
 * Re-verified against the reference image: the badge is a solid copper
 * rounded square (not an outline), the anvil glyph inside it is flat/ivory
 * (not a literal 3D render), and the "SearchAnvil" wordmark next to it is a
 * single ivory color all the way through — no two-tone split on "Anvil".
 * That two-tone treatment was this component's previous behavior; it's
 * removed below to match.
 */

export type LogoTone = "dark" | "light";

interface MarkProps {
  className?: string;
  size?: number;
  tone?: LogoTone;
}

/** The standalone symbol: a solid copper rounded-square badge with a flat anvil silhouette. */
export function AnvilMark({ className, size = 32, tone = "dark" }: MarkProps): React.ReactElement {
  const glyphColor = tone === "dark" ? "#F5F2EC" : "#090B0E";

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="SearchAnvil symbol"
    >
      <rect width="40" height="40" rx="10" fill="#EF9856" />
      {/* Flat anvil silhouette: working face, waist, base — simplified, not a 3D render. */}
      <path d="M8 14.5 11.5 12h17l3.5 2.5-0.8 3H8.8l-0.8-3Z" fill={glyphColor} />
      <rect x="16.5" y="18" width="7" height="5" fill={glyphColor} />
      <path d="M11 26.5 14.5 24h11l3.5 2.5-1.2 3.5H12.2L11 26.5Z" fill={glyphColor} />
    </svg>
  );
}

interface WordmarkProps {
  className?: string;
  tone?: LogoTone;
}

/** The wordmark: display-face type, no spaced-letter tracking, a single ivory/ink color. */
export function Wordmark({ className, tone = "dark" }: WordmarkProps): React.ReactElement {
  const color = tone === "dark" ? "text-steel-100" : "text-ink";
  return (
    <span className={`font-display text-lg font-semibold tracking-tight ${color} ${className ?? ""}`}>
      SearchAnvil
    </span>
  );
}

interface LockupProps {
  className?: string;
  tone?: LogoTone;
  size?: number;
}

/** The default lockup used in nav/footer: mark + wordmark, horizontally combined. */
export function Lockup({ className, tone = "dark", size = 28 }: LockupProps): React.ReactElement {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <AnvilMark size={size} tone={tone} />
      <Wordmark tone={tone} />
    </span>
  );
}
