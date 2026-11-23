import { fileURLToPath } from "node:url";

const desktop = process.env.NEXT_PUBLIC_SEARCHANVIL_DESKTOP === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@searchanvil/ui", "@searchanvil/shared"],
  ...(desktop
    ? {
        output: "standalone",
        outputFileTracingRoot: fileURLToPath(new URL("../../", import.meta.url)),
        env: { NEXT_PUBLIC_API_URL: "/desktop-api" },
      }
    : {}),
};

export default nextConfig;
