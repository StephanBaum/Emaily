/**
 * Email provider module
 * Exports all email-related types and services
 */

// Types
export * from "./types";

// Gmail service
export { GmailService, createGmailService, batchFetchEmails } from "./gmail";

// Outlook service
export { OutlookService, createOutlookService, batchFetchOutlookEmails } from "./outlook";

// Unified provider interface
export {
  type IEmailProvider,
  type EmailProfile,
  type UnifiedEmailAction,
  createEmailProvider,
  withRetry,
  batchExecute,
  executeEmailAction,
} from "./provider";

// Sync service
export {
  type SyncOptions,
  type SyncProgress,
  type SyncResult,
  type PrismaEmailClient,
  type SyncJob,
  EmailSyncService,
  createSyncService,
  syncAllUserAccounts,
  SyncJobQueue,
  syncJobQueue,
} from "./sync";
