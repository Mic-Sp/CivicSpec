import "server-only";

import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Client construction is lazy about connections; Step 1 never queries the database.
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: env.DATABASE_URL,
});

// Reuse the same pool across Next.js development hot reloads.
if (env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
