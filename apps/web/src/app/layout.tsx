import type { Metadata } from "next";
import { Newsreader, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE_ORIGIN } from "@/lib/site-config";

// One display face (headlines, the wordmark), one body face (everything
// else), one mono face used sparingly for technical labels/data. Loaded via
// next/font so they're self-hosted and never block on a third-party
// stylesheet request.
//
// Display face: Newsreader. The approved reference mockup sets headlines in
// a classic transitional serif (moderate stroke contrast, bracketed
// serifs, a plain curly apostrophe) — closer to an editorial/book face than
// a display-quirky one. Of the free Google Serif families compared against
// it, Fraunces was ruled out (its "soft"/wonky optical-size terminals read
// as more playful than the reference), Libre Caslon Text was ruled out (its
// lowercase is narrower and more old-style than the reference's even,
// rounded letterforms), and Newsreader was the closest match: it's a
// transitional serif purpose-built to resemble a classic book/editorial
// face at display sizes, which is what the reference headline looks like.
const display = Newsreader({
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal"],
  variable: "--font-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "SearchAnvil — Forge Better Search Performance",
    template: "%s · SearchAnvil",
  },
  description:
    "SearchAnvil crawls your website and reveals the hidden structure beneath it — what's broken, what matters most, and what to fix first.",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" className={`dark ${display.variable} ${body.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
