import { PrismaClient } from "@prisma/client";

/**
 * Prisma client singleton for database operations.
 *
 * In development, we store the client on globalThis to prevent
 * multiple instances during hot reloading.
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Create a new Prisma client instance with logging configuration.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });
}

/**
 * Prisma client singleton instance.
 * Reuses existing instance in development to prevent connection pool exhaustion.
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect from the database.
 * Useful for cleanup in tests or serverless environments.
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Connect to the database.
 * Prisma auto-connects on first query, but this can be used for explicit connection.
 */
export async function connect(): Promise<void> {
  await prisma.$connect();
}
