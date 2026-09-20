import { PrismaClient } from "@prisma/client";
import { randomBytes, scryptSync } from "node:crypto";

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: "demo@searchanvil.com" },
    update: {},
    create: {
      email: "demo@searchanvil.com",
      name: "Demo User",
      passwordHash: hashPassword("ChangeMe123!"),
      emailVerifiedAt: new Date(),
    },
  });

  const organization = await prisma.organization.upsert({
    where: { slug: "demo-org" },
    update: {},
    create: {
      name: "Demo Organization",
      slug: "demo-org",
      members: {
        create: {
          userId: user.id,
          role: "OWNER",
        },
      },
    },
  });

  const project = await prisma.project.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      organizationId: organization.id,
      name: "Demo Project",
    },
  });

  await prisma.site.upsert({
    where: { projectId_rootUrl: { projectId: project.id, rootUrl: "https://example.com" } },
    update: {},
    create: {
      projectId: project.id,
      displayName: "Example.com",
      rootUrl: "https://example.com",
    },
  });

  // eslint-disable-next-line no-console
  console.warn("Seed complete: demo@searchanvil.com / ChangeMe123!");
}

main()
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
