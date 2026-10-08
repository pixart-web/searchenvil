/**
 * Scene 6 (Pricing/Closing) artwork: a restrained, smaller echo of the
 * hero's "anvil on rock, copper glow" backdrop — the reference mockup's
 * closing-scene artwork, scaled down and stilled since this scene's job is
 * the price and the CTA, not another animated sequence.
 *
 * This is a stylized CSS/SVG approximation, not a photographic match: no
 * photorealistic image-generation tool is available in this environment,
 * so the reference's painterly anvil-on-rock illustration is approximated
 * here with layered gradients, an SVG rock silhouette, and a simple flat
 * anvil glyph rather than redrawn in detail or faked as a raster image.
 * See docs/MARKETING_SITE.md for the other approximated spot (the hero
 * backdrop in HeroComposition.tsx).
 */
export function ClosingArt(): React.ReactElement {
  return (
    <div aria-hidden="true" className="relative mx-auto h-64 w-full max-w-md overflow-hidden sm:h-72">
      {/* Copper glow */}
      <div
        className="absolute left-1/2 top-[38%] h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-80 blur-3xl"
        style={{ background: "radial-gradient(circle, rgba(239,152,86,0.5), rgba(239,152,86,0.06) 60%, transparent 75%)" }}
      />

      {/* Rock silhouette */}
      <svg viewBox="0 0 400 260" preserveAspectRatio="none" className="absolute inset-x-0 bottom-0 h-[70%] w-full">
        <polygon points="0,260 0,150 60,120 130,160 210,110 290,155 360,120 400,145 400,260" fill="#0C0F13" />
        <polygon points="0,260 0,185 90,165 180,195 260,160 340,190 400,175 400,260" fill="#14181E" opacity={0.85} />
      </svg>

      {/* A thin copper light line rising from the rock, echoing the hero's connective lines */}
      <div
        className="absolute left-1/2 top-[18%] h-28 w-px -translate-x-1/2 bg-gradient-to-t from-ember-500/70 to-transparent"
      />

      {/* Flat anvil glyph standing on the rock, catching the glow */}
      <svg
        viewBox="0 0 40 40"
        className="absolute left-1/2 top-[40%] h-12 w-12 -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_0_18px_rgba(239,152,86,0.55)]"
        role="img"
        aria-label="Anvil"
      >
        <path d="M8 14.5 11.5 12h17l3.5 2.5-0.8 3H8.8l-0.8-3Z" fill="#C3C8D1" />
        <rect x="16.5" y="18" width="7" height="5" fill="#C3C8D1" />
        <path d="M11 26.5 14.5 24h11l3.5 2.5-1.2 3.5H12.2L11 26.5Z" fill="#C3C8D1" />
      </svg>

      <p className="absolute bottom-3 left-1/2 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.2em] text-steel-600">
        Resolved
      </p>
    </div>
  );
}
