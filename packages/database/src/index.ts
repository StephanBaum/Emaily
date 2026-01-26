/**
 * @email-ai/database
 *
 * Shared database package providing Prisma client and utilities
 * for the AI-enabled email client application.
 */

// Export Prisma client singleton and utilities
export { prisma, connect, disconnect } from "./client";

// Re-export all Prisma types for convenience
export type {
  User,
  EmailAccount,
  Email,
  Prisma,
} from "@prisma/client";

// Re-export PrismaClient class for type usage
export { PrismaClient } from "@prisma/client";
