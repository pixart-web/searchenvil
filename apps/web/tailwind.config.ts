import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}", "../../packages/ui/src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        forge: {
          950: "#090B0E",
          900: "#14181E",
          850: "#191D24",
          800: "#1D232C",
        },
        steel: {
          600: "#6B7280",
          500: "#7D8492",
          400: "#A8AFBA",
          300: "#C3C8D1",
          100: "#F5F2EC",
        },
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
        paper: {
          DEFAULT: "#F0ECE4",
          raised: "#E7E1D5",
          line: "#D9D1C0",
        },
        ink: {
          DEFAULT: "#171B20",
          muted: "#4B5058",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        DEFAULT: "6px",
        lg: "10px",
      },
    },
  },
  plugins: [],
};

export default config;
