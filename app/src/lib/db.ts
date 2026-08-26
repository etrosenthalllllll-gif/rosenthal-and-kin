// Prisma Client singleton -- the standard Next.js pattern. Hot-reload in
// dev creates a fresh module scope on every edit; without stashing the
// client on `globalThis`, each reload would open a new pool of Postgres
// connections until the free-tier connection limit was exhausted.
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
