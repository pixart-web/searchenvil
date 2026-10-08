import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "SearchAnvil — reveal the hidden structure of your website";

/**
 * Default OG image for the marketing site (used by any page that doesn't
 * define its own). Built from the brand's own shapes — the anvil mark plus
 * a set of layered "page" rectangles standing in for a crawled site — not a
 * stock template, and not a screenshot of the product UI.
 */
export default function OpengraphImage(): ImageResponse {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "80px",
          background: "#090B0E",
          backgroundImage:
            "radial-gradient(circle at 82% 18%, rgba(239,152,86,0.16), transparent 55%)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", maxWidth: 620 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <svg width="52" height="52" viewBox="0 0 40 40">
              <rect width="40" height="40" rx="10" fill="#EF9856" />
              <path d="M8 14.5 11.5 12h17l3.5 2.5-0.8 3H8.8l-0.8-3Z" fill="#F5F2EC" />
              <rect x="16.5" y="18" width="7" height="5" fill="#F5F2EC" />
              <path d="M11 26.5 14.5 24h11l3.5 2.5-1.2 3.5H12.2L11 26.5Z" fill="#F5F2EC" />
            </svg>
            <div style={{ display: "flex", fontSize: 40, fontWeight: 700, color: "#F5F2EC" }}>
              SearchAnvil
            </div>
          </div>
          <div style={{ display: "flex", marginTop: 36, fontSize: 44, fontWeight: 600, color: "#F5F2EC", lineHeight: 1.15 }}>
            Reveal the hidden structure of your website.
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 24, color: "#A8AFBA" }}>
            A technical SEO audit platform — real crawl facts, ranked into what to fix first.
          </div>
        </div>

        <div style={{ display: "flex", position: "relative", width: 380, height: 420 }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                display: "flex",
                position: "absolute",
                top: 40 + i * 34,
                left: i * 26,
                width: 300,
                height: 200,
                borderRadius: 12,
                background: "#14181E",
                border: "1px solid #1D232C",
                boxShadow: "0 30px 60px rgba(0,0,0,0.45)",
              }}
            />
          ))}
          <div
            style={{
              display: "flex",
              position: "absolute",
              top: 40,
              left: 0,
              width: 300,
              height: 200,
              borderRadius: 12,
              border: "2px solid #EF9856",
            }}
          />
        </div>
      </div>
    ),
    { ...size },
  );
}
