/**
 * SearchAnvil brand tokens. This is the single source of truth for the hex
 * values — apps/web/tailwind.config.ts mirrors these under theme.extend.colors.
 * Non-Tailwind consumers (e.g. chart libraries in later phases) import from here.
 */
export const colors = {
  forge: {
    950: "#090A0F",
    900: "#101119",
    850: "#151620",
    800: "#1C1D29",
  },
  steel: {
    500: "#74798C",
    400: "#9296A8",
    300: "#B4B7C4",
    100: "#E8E9EF",
  },
  ember: {
    600: "#BD6F32",
    500: "#D98A45",
    400: "#E9A45F",
  },
  violet: {
    500: "#865DFF",
  },
  success: "#36B978",
  warning: "#E3A72F",
  danger: "#E65353",
} as const;

export type SemanticStatus = "success" | "warning" | "danger";
