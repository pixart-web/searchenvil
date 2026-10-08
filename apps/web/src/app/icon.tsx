import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/**
 * Generated favicon built from the same anvil-mark geometry as
 * src/components/marketing/Logo.tsx (Satori, the ImageResponse renderer,
 * can't import that client component directly, so the path data is
 * duplicated here — keep the two in sync if the mark changes). Matches the
 * reference mockup's solid copper rounded-square badge with a flat ivory
 * anvil silhouette.
 */
export default function Icon(): ImageResponse {
  return new ImageResponse(
    (
      <svg width="32" height="32" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
        <rect width="40" height="40" rx="10" fill="#EF9856" />
        <path d="M8 14.5 11.5 12h17l3.5 2.5-0.8 3H8.8l-0.8-3Z" fill="#F5F2EC" />
        <rect x="16.5" y="18" width="7" height="5" fill="#F5F2EC" />
        <path d="M11 26.5 14.5 24h11l3.5 2.5-1.2 3.5H12.2L11 26.5Z" fill="#F5F2EC" />
      </svg>
    ),
    { ...size },
  );
}
