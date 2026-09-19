import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

// NestJS relies on TypeScript's emitDecoratorMetadata for constructor-based
// DI (design:paramtypes). Vitest's default esbuild transform does not emit
// that metadata, so without this plugin every Nest provider resolves its
// constructor params as undefined. SWC's decorator transform matches tsc's
// output closely enough for Nest's reflection-based DI to work.
export default defineConfig({
  plugins: [swc.vite()],
  test: {
    environment: "node",
    include: ["test/**/*.e2e-spec.ts"],
    testTimeout: 30_000,
  },
});
