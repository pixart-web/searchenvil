import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SearchEnvil — Forge Better Search Performance",
    template: "%s · SearchEnvil",
  },
  description:
    "SearchEnvil crawls your website, identifies what actually matters and helps you understand what to fix first.",
};

export default function RootLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
