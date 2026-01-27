/**
 * Prisma client singleton for API routes.
 *
 * Re-exports the shared Prisma client from @email-ai/database package
 * to provide a clean import path for API routes: `@/lib/prisma`
 *
 * Usage in API routes:
 * ```typescript
 * import { prisma } from '@/lib/prisma';
 *
 * const emails = await prisma.email.findMany({
 *   orderBy: { receivedAt: 'desc' },
 *   take: 50,
 * });
 * ```
 */

// Re-export the Prisma client singleton from the shared database package
export { prisma, connect, disconnect } from "@email-ai/database";

// Re-export commonly used types for convenience in API routes
export type {
  User,
  Account,
  Session,
  EmailAccount,
  Email,
  NotificationPreference,
  PushSubscription,
  Prisma,
} from "@email-ai/database";
