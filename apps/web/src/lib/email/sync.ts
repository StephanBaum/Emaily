/**
 * Email Sync Service
 * Handles syncing emails between email providers and the local database
 */

import type { Email, EmailAccount, Prisma } from "@email-ai/database";
import { IEmailProvider, createEmailProvider, withRetry, batchExecute } from "./provider";
import {
  EmailProvider,
  NormalizedEmail,
  FetchEmailsOptions,
  EmailOAuthTokens,
  EmailProviderError,
} from "./types";

/**
 * Options for email sync operations
 */
export interface SyncOptions {
  /** Maximum number of emails to sync per batch */
  batchSize?: number;
  /** Maximum total emails to sync (for initial sync limits) */
  maxEmails?: number;
  /** Whether to process AI categorization during sync */
  processAI?: boolean;
  /** Callback for sync progress updates */
  onProgress?: (progress: SyncProgress) => void;
  /** Callback for sync errors (non-fatal) */
  onError?: (error: Error, context: string) => void;
}

/**
 * Sync progress information
 */
export interface SyncProgress {
  /** Current phase of sync */
  phase: "fetching" | "processing" | "saving" | "complete";
  /** Number of emails fetched so far */
  fetched: number;
  /** Number of emails processed so far */
  processed: number;
  /** Number of emails saved to database */
  saved: number;
  /** Number of new emails (not previously synced) */
  newEmails: number;
  /** Number of updated emails */
  updatedEmails: number;
  /** Total emails to process (if known) */
  total?: number;
}

/**
 * Result of a sync operation
 */
export interface SyncResult {
  /** Whether sync completed successfully */
  success: boolean;
  /** Number of new emails synced */
  newEmails: number;
  /** Number of existing emails updated */
  updatedEmails: number;
  /** Total emails processed */
  totalProcessed: number;
  /** Errors encountered during sync */
  errors: Array<{ messageId?: string; error: string }>;
  /** Timestamp of sync completion */
  syncedAt: Date;
  /** Next page token for incremental sync */
  nextPageToken?: string | null;
}

/**
 * Prisma client interface (subset needed for sync operations)
 * This allows dependency injection for testing
 */
export interface PrismaEmailClient {
  email: {
    findUnique: (args: { where: { messageId: string } }) => Promise<Email | null>;
    findMany: (args: Prisma.EmailFindManyArgs) => Promise<Email[]>;
    create: (args: { data: Prisma.EmailCreateInput }) => Promise<Email>;
    update: (args: { where: { messageId: string }; data: Prisma.EmailUpdateInput }) => Promise<Email>;
    upsert: (args: {
      where: { messageId: string };
      create: Prisma.EmailCreateInput;
      update: Prisma.EmailUpdateInput;
    }) => Promise<Email>;
    delete: (args: { where: { messageId: string } }) => Promise<Email>;
    deleteMany: (args: { where: { accountId: string } }) => Promise<{ count: number }>;
  };
  emailAccount: {
    findUnique: (args: { where: { id: string } }) => Promise<EmailAccount | null>;
    update: (args: { where: { id: string }; data: Prisma.EmailAccountUpdateInput }) => Promise<EmailAccount>;
  };
}

/**
 * Email Sync Service
 * Manages the synchronization of emails between providers and local database
 */
export class EmailSyncService {
  private provider: IEmailProvider;
  private prisma: PrismaEmailClient;
  private accountId: string;

  constructor(
    prisma: PrismaEmailClient,
    provider: IEmailProvider,
    accountId: string
  ) {
    this.prisma = prisma;
    this.provider = provider;
    this.accountId = accountId;
  }

  /**
   * Perform a full sync of emails from the provider
   * This fetches all emails up to the specified limit
   */
  async fullSync(options: SyncOptions = {}): Promise<SyncResult> {
    const {
      batchSize = 50,
      maxEmails = 500,
      onProgress,
      onError,
    } = options;

    const progress: SyncProgress = {
      phase: "fetching",
      fetched: 0,
      processed: 0,
      saved: 0,
      newEmails: 0,
      updatedEmails: 0,
    };

    const errors: Array<{ messageId?: string; error: string }> = [];
    let pageToken: string | null = null;

    try {
      // Fetch and process emails in batches
      while (progress.fetched < maxEmails) {
        const fetchOptions: FetchEmailsOptions = {
          maxResults: Math.min(batchSize, maxEmails - progress.fetched),
          pageToken: pageToken || undefined,
        };

        progress.phase = "fetching";
        onProgress?.(progress);

        const result = await withRetry(() => this.provider.fetchEmails(fetchOptions));
        progress.fetched += result.emails.length;
        progress.total = result.resultSizeEstimate;

        // Process and save each email
        progress.phase = "processing";
        onProgress?.(progress);

        for (const email of result.emails) {
          try {
            const saveResult = await this.saveEmail(email);
            progress.processed++;

            if (saveResult.isNew) {
              progress.newEmails++;
            } else {
              progress.updatedEmails++;
            }
            progress.saved++;
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            errors.push({ messageId: email.id, error: errorMessage });
            onError?.(error as Error, `Failed to save email ${email.id}`);
          }
        }

        onProgress?.(progress);

        // Check if we have more pages
        pageToken = result.nextPageToken;
        if (!pageToken || result.emails.length === 0) {
          break;
        }
      }

      progress.phase = "complete";
      onProgress?.(progress);

      return {
        success: true,
        newEmails: progress.newEmails,
        updatedEmails: progress.updatedEmails,
        totalProcessed: progress.processed,
        errors,
        syncedAt: new Date(),
        nextPageToken: pageToken,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      errors.push({ error: errorMessage });

      return {
        success: false,
        newEmails: progress.newEmails,
        updatedEmails: progress.updatedEmails,
        totalProcessed: progress.processed,
        errors,
        syncedAt: new Date(),
      };
    }
  }

  /**
   * Perform an incremental sync of new emails
   * Only fetches emails that are newer than the last sync
   */
  async incrementalSync(options: SyncOptions = {}): Promise<SyncResult> {
    const {
      batchSize = 50,
      maxEmails = 100,
      onProgress,
      onError,
    } = options;

    const progress: SyncProgress = {
      phase: "fetching",
      fetched: 0,
      processed: 0,
      saved: 0,
      newEmails: 0,
      updatedEmails: 0,
    };

    const errors: Array<{ messageId?: string; error: string }> = [];

    try {
      // Get the most recent email timestamp from our database
      const latestEmails = await this.prisma.email.findMany({
        where: { accountId: this.accountId },
        orderBy: { receivedAt: "desc" },
        take: 1,
      });

      const lastSyncDate = latestEmails.length > 0
        ? latestEmails[0].receivedAt
        : new Date(0);

      // Fetch emails newer than our last sync
      progress.phase = "fetching";
      onProgress?.(progress);

      const result = await withRetry(() =>
        this.provider.fetchEmails({
          maxResults: Math.min(batchSize, maxEmails),
        })
      );

      // Filter to only new emails (comparing by date since we can't query by date in all providers)
      const newEmailsFromProvider = result.emails.filter(
        (email) => email.receivedAt > lastSyncDate
      );

      progress.fetched = newEmailsFromProvider.length;
      progress.phase = "processing";
      onProgress?.(progress);

      // Process and save each new email
      for (const email of newEmailsFromProvider) {
        try {
          const saveResult = await this.saveEmail(email);
          progress.processed++;

          if (saveResult.isNew) {
            progress.newEmails++;
          } else {
            progress.updatedEmails++;
          }
          progress.saved++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          errors.push({ messageId: email.id, error: errorMessage });
          onError?.(error as Error, `Failed to save email ${email.id}`);
        }
      }

      progress.phase = "complete";
      onProgress?.(progress);

      return {
        success: true,
        newEmails: progress.newEmails,
        updatedEmails: progress.updatedEmails,
        totalProcessed: progress.processed,
        errors,
        syncedAt: new Date(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      errors.push({ error: errorMessage });

      return {
        success: false,
        newEmails: progress.newEmails,
        updatedEmails: progress.updatedEmails,
        totalProcessed: progress.processed,
        errors,
        syncedAt: new Date(),
      };
    }
  }

  /**
   * Sync a specific email by ID
   * Useful for updating a single email after an action
   */
  async syncEmail(messageId: string): Promise<{ success: boolean; email?: Email; error?: string }> {
    try {
      const email = await withRetry(() => this.provider.getEmail(messageId));

      if (!email) {
        // Email was deleted from provider, remove from our database
        await this.prisma.email.delete({
          where: { messageId },
        }).catch(() => {
          // Ignore if email doesn't exist in our database
        });

        return { success: true };
      }

      const result = await this.saveEmail(email);
      return { success: true, email: result.email };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Save a normalized email to the database
   * Creates new or updates existing email
   */
  private async saveEmail(email: NormalizedEmail): Promise<{ email: Email; isNew: boolean }> {
    // Check if email already exists
    const existingEmail = await this.prisma.email.findUnique({
      where: { messageId: email.id },
    });

    const emailData: Prisma.EmailCreateInput = {
      messageId: email.id,
      threadId: email.threadId,
      subject: email.subject,
      sender: this.formatEmailAddress(email.from),
      recipients: email.to.map((addr) => this.formatEmailAddress(addr)),
      body: email.bodyText,
      bodyHtml: email.bodyHtml,
      isRead: email.isRead,
      isStarred: email.isStarred,
      receivedAt: email.receivedAt,
      account: { connect: { id: this.accountId } },
    };

    if (existingEmail) {
      // Update existing email (only fields that might have changed)
      const updatedEmail = await this.prisma.email.update({
        where: { messageId: email.id },
        data: {
          isRead: email.isRead,
          isStarred: email.isStarred,
          updatedAt: new Date(),
        },
      });
      return { email: updatedEmail, isNew: false };
    } else {
      // Create new email
      const newEmail = await this.prisma.email.create({
        data: emailData,
      });
      return { email: newEmail, isNew: true };
    }
  }

  /**
   * Format an email address for storage
   */
  private formatEmailAddress(address: { email: string; name: string | null }): string {
    if (address.name) {
      return `${address.name} <${address.email}>`;
    }
    return address.email;
  }

  /**
   * Delete all synced emails for this account
   * Useful for re-sync or account disconnection
   */
  async clearSyncedEmails(): Promise<{ deletedCount: number }> {
    const result = await this.prisma.email.deleteMany({
      where: { accountId: this.accountId },
    });
    return { deletedCount: result.count };
  }

  /**
   * Get sync statistics for this account
   */
  async getSyncStats(): Promise<{
    totalEmails: number;
    unreadEmails: number;
    starredEmails: number;
    oldestEmail?: Date;
    newestEmail?: Date;
  }> {
    const emails = await this.prisma.email.findMany({
      where: { accountId: this.accountId },
      select: {
        isRead: true,
        isStarred: true,
        receivedAt: true,
      },
      orderBy: { receivedAt: "asc" },
    });

    return {
      totalEmails: emails.length,
      unreadEmails: emails.filter((e) => !e.isRead).length,
      starredEmails: emails.filter((e) => e.isStarred).length,
      oldestEmail: emails.length > 0 ? emails[0].receivedAt : undefined,
      newestEmail: emails.length > 0 ? emails[emails.length - 1].receivedAt : undefined,
    };
  }
}

/**
 * Create an EmailSyncService from account information
 */
export function createSyncService(
  prisma: PrismaEmailClient,
  account: {
    id: string;
    provider: string;
    accessToken: string;
    refreshToken?: string | null;
  }
): EmailSyncService {
  const tokens: EmailOAuthTokens = {
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
  };

  const provider = createEmailProvider(account.provider as EmailProvider, tokens);
  return new EmailSyncService(prisma, provider, account.id);
}

/**
 * Sync all accounts for a user
 */
export async function syncAllUserAccounts(
  prisma: PrismaEmailClient & {
    emailAccount: {
      findMany: (args: {
        where: { userId: string };
      }) => Promise<EmailAccount[]>;
    };
  },
  userId: string,
  options: SyncOptions = {}
): Promise<Map<string, SyncResult>> {
  const accounts = await prisma.emailAccount.findMany({
    where: { userId },
  });

  const results = new Map<string, SyncResult>();

  for (const account of accounts) {
    try {
      const syncService = createSyncService(prisma, account);
      const result = await syncService.incrementalSync(options);
      results.set(account.id, result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      results.set(account.id, {
        success: false,
        newEmails: 0,
        updatedEmails: 0,
        totalProcessed: 0,
        errors: [{ error: errorMessage }],
        syncedAt: new Date(),
      });
    }
  }

  return results;
}

/**
 * Queue-based sync job for background processing
 */
export interface SyncJob {
  id: string;
  accountId: string;
  type: "full" | "incremental";
  status: "pending" | "running" | "completed" | "failed";
  progress?: SyncProgress;
  result?: SyncResult;
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;
}

/**
 * Simple in-memory sync job queue
 * For production, replace with a proper job queue (Bull, Agenda, etc.)
 */
export class SyncJobQueue {
  private jobs: Map<string, SyncJob> = new Map();
  private processing: Set<string> = new Set();

  /**
   * Add a sync job to the queue
   */
  async addJob(
    accountId: string,
    type: "full" | "incremental"
  ): Promise<SyncJob> {
    const job: SyncJob = {
      id: `${accountId}-${Date.now()}`,
      accountId,
      type,
      status: "pending",
      createdAt: new Date(),
    };

    this.jobs.set(job.id, job);
    return job;
  }

  /**
   * Get a job by ID
   */
  getJob(jobId: string): SyncJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all jobs for an account
   */
  getJobsForAccount(accountId: string): SyncJob[] {
    return Array.from(this.jobs.values()).filter(
      (job) => job.accountId === accountId
    );
  }

  /**
   * Update job status
   */
  updateJob(jobId: string, updates: Partial<SyncJob>): void {
    const job = this.jobs.get(jobId);
    if (job) {
      Object.assign(job, updates);
    }
  }

  /**
   * Process a job
   */
  async processJob(
    jobId: string,
    prisma: PrismaEmailClient,
    getAccount: (accountId: string) => Promise<EmailAccount | null>,
    options?: SyncOptions
  ): Promise<SyncResult | null> {
    const job = this.jobs.get(jobId);
    if (!job || this.processing.has(jobId)) {
      return null;
    }

    this.processing.add(jobId);
    this.updateJob(jobId, { status: "running", startedAt: new Date() });

    try {
      const account = await getAccount(job.accountId);
      if (!account) {
        throw new Error("Account not found");
      }

      const syncService = createSyncService(prisma, account);
      const result = job.type === "full"
        ? await syncService.fullSync({
            ...options,
            onProgress: (progress) => {
              this.updateJob(jobId, { progress });
            },
          })
        : await syncService.incrementalSync({
            ...options,
            onProgress: (progress) => {
              this.updateJob(jobId, { progress });
            },
          });

      this.updateJob(jobId, {
        status: "completed",
        result,
        completedAt: new Date(),
      });

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      const result: SyncResult = {
        success: false,
        newEmails: 0,
        updatedEmails: 0,
        totalProcessed: 0,
        errors: [{ error: errorMessage }],
        syncedAt: new Date(),
      };

      this.updateJob(jobId, {
        status: "failed",
        result,
        completedAt: new Date(),
      });

      return result;
    } finally {
      this.processing.delete(jobId);
    }
  }

  /**
   * Clean up old completed/failed jobs
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoff = Date.now() - maxAgeMs;
    let cleaned = 0;

    for (const [id, job] of this.jobs) {
      if (
        (job.status === "completed" || job.status === "failed") &&
        job.createdAt.getTime() < cutoff
      ) {
        this.jobs.delete(id);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Export a default queue instance
export const syncJobQueue = new SyncJobQueue();
