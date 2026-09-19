import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __searchenvilPrisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Reuse a single PrismaClient across hot reloads in development so we don't
// exhaust Postgres connections when Next.js/Nest recompiles modules.
export const prisma: PrismaClient = globalThis.__searchenvilPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__searchenvilPrisma = prisma;
}

export * from "@prisma/client";
