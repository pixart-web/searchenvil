/**
 * SearchAnvil brand tokens. This is the single source of truth for the hex
 * values — apps/web/tailwind.config.ts mirrors these under theme.extend.colors.
 * Non-Tailwind consumers (e.g. chart libraries in later phases) import from here.
 */
export const colors = {
  // Obsidian/graphite scale — forge-950/900/800 fold the near-identical
  // legacy hexes into the new obsidian brief values (forge-850 kept as an
  // interpolated hover step between forge-900 and forge-800).
  forge: {
    950: "#090B0E", // background
    900: "#14181E", // surface
    850: "#191D24",
    800: "#1D232C", // surface-raised
  },
  // Warm-ivory text scale — steel-100 is now warm ivory (was cool #E8E9EF).
  steel: {
    600: "#6B7280",
    500: "#7D8492",
    400: "#A8AFBA",
    300: "#C3C8D1",
    100: "#F5F2EC",
  },
  // Copper-orange accent — brighter/warmer than the old ember.
  ember: {
    700: "#9A4712", // AA-contrast variant for accent text on the paper (light) background
    600: "#C97A3D",
    500: "#EF9856",
    400: "#F3AD75",
  },
  violet: {
    500: "#865DFF",
  },
  success: "#36B978",
  warning: "#E3A72F",
  danger: "#E65353",
  // New warm-ivory light section (Priorities scene) + its ink text color.
  paper: {
    DEFAULT: "#F0ECE4",
    raised: "#E7E1D5",
    line: "#D9D1C0",
  },
  ink: {
    DEFAULT: "#171B20",
    muted: "#4B5058",
  },
} as const;

export type SemanticStatus = "success" | "warning" | "danger";
