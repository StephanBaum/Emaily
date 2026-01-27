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
  Account,
  Session,
  VerificationToken,
  EmailAccount,
  Email,
  Prisma,
} from "@prisma/client";

// Re-export PrismaClient class for type usage
export { PrismaClient } from "@prisma/client";

// Export OAuth token encryption utilities
export {
  encryptOAuthToken,
  decryptOAuthToken,
  encryptOAuthTokens,
  decryptOAuthTokens,
  batchEncryptTokens,
  batchDecryptTokens,
} from "./token-encryption";

// Export OAuth token encryption types
export type { TokenPair, EncryptedTokenPair } from "./token-encryption";
