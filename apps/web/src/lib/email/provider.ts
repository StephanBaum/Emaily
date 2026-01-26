/**
 * Unified Email Provider Interface
 * Provides a common interface for interacting with different email providers (Gmail, Outlook)
 */

import { GmailService, createGmailService } from "./gmail";
import { OutlookService, createOutlookService } from "./outlook";
import { ImapService, createImapService } from "./imap";
import { SmtpService, createSmtpServiceFromImapConfig } from "./smtp";
import {
  EmailProvider,
  NormalizedEmail,
  FetchEmailsOptions,
  FetchEmailsResult,
  SendEmailOptions,
  SendEmailResult,
  EmailOAuthTokens,
  ImapConfig,
  ModifyLabelsOptions,
  EmailProviderError,
} from "./types";

/**
 * Common interface for all email provider operations
 * Abstracts the differences between Gmail and Outlook APIs
 */
export interface IEmailProvider {
  /** The provider type */
  readonly provider: EmailProvider;

  /** Fetch emails with pagination support */
  fetchEmails(options?: FetchEmailsOptions): Promise<FetchEmailsResult>;

  /** Get a single email by ID */
  getEmail(messageId: string): Promise<NormalizedEmail | null>;

  /** Send an email */
  sendEmail(options: SendEmailOptions): Promise<SendEmailResult>;

  /** Archive an email (remove from inbox) */
  archiveEmail(messageId: string): Promise<void>;

  /** Move email to trash */
  trashEmail(messageId: string): Promise<void>;

  /** Permanently delete an email */
  deleteEmail(messageId: string): Promise<void>;

  /** Mark email as read */
  markAsRead(messageId: string): Promise<void>;

  /** Mark email as unread */
  markAsUnread(messageId: string): Promise<void>;

  /** Star/flag an email */
  starEmail(messageId: string): Promise<void>;

  /** Unstar/unflag an email */
  unstarEmail(messageId: string): Promise<void>;

  /** Mark email as spam/junk */
  markAsSpam(messageId: string): Promise<void>;

  /** Remove spam/junk label */
  removeSpam(messageId: string): Promise<void>;

  /** Modify labels/folders on an email */
  modifyLabels(messageId: string, options: ModifyLabelsOptions): Promise<void>;

  /** Get attachment content */
  getAttachment(messageId: string, attachmentId: string): Promise<Buffer>;

  /** Get user's email profile */
  getProfile(): Promise<EmailProfile>;
}

/**
 * User email profile information
 */
export interface EmailProfile {
  /** User's email address */
  email: string;
  /** Display name (if available) */
  displayName?: string;
  /** Total messages (Gmail only) */
  messagesTotal?: number;
  /** Total threads (Gmail only) */
  threadsTotal?: number;
}

/**
 * Gmail provider implementation of IEmailProvider
 */
class GmailProvider implements IEmailProvider {
  readonly provider: EmailProvider = "google";
  private service: GmailService;

  constructor(tokens: EmailOAuthTokens) {
    this.service = createGmailService(tokens);
  }

  async fetchEmails(options?: FetchEmailsOptions): Promise<FetchEmailsResult> {
    return this.service.fetchEmails(options);
  }

  async getEmail(messageId: string): Promise<NormalizedEmail | null> {
    return this.service.getEmail(messageId);
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return this.service.sendEmail(options);
  }

  async archiveEmail(messageId: string): Promise<void> {
    return this.service.archiveEmail(messageId);
  }

  async trashEmail(messageId: string): Promise<void> {
    return this.service.trashEmail(messageId);
  }

  async deleteEmail(messageId: string): Promise<void> {
    return this.service.deleteEmail(messageId);
  }

  async markAsRead(messageId: string): Promise<void> {
    return this.service.markAsRead(messageId);
  }

  async markAsUnread(messageId: string): Promise<void> {
    return this.service.markAsUnread(messageId);
  }

  async starEmail(messageId: string): Promise<void> {
    return this.service.starEmail(messageId);
  }

  async unstarEmail(messageId: string): Promise<void> {
    return this.service.unstarEmail(messageId);
  }

  async markAsSpam(messageId: string): Promise<void> {
    return this.service.markAsSpam(messageId);
  }

  async removeSpam(messageId: string): Promise<void> {
    return this.service.removeSpam(messageId);
  }

  async modifyLabels(messageId: string, options: ModifyLabelsOptions): Promise<void> {
    return this.service.modifyLabels(messageId, options);
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    return this.service.getAttachment(messageId, attachmentId);
  }

  async getProfile(): Promise<EmailProfile> {
    const profile = await this.service.getProfile();
    return {
      email: profile.email,
      messagesTotal: profile.messagesTotal,
      threadsTotal: profile.threadsTotal,
    };
  }
}

/**
 * Outlook provider implementation of IEmailProvider
 */
class OutlookProvider implements IEmailProvider {
  readonly provider: EmailProvider = "microsoft";
  private service: OutlookService;

  constructor(tokens: EmailOAuthTokens) {
    this.service = createOutlookService(tokens);
  }

  async fetchEmails(options?: FetchEmailsOptions): Promise<FetchEmailsResult> {
    return this.service.fetchEmails(options);
  }

  async getEmail(messageId: string): Promise<NormalizedEmail | null> {
    return this.service.getEmail(messageId);
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return this.service.sendEmail(options);
  }

  async archiveEmail(messageId: string): Promise<void> {
    return this.service.archiveEmail(messageId);
  }

  async trashEmail(messageId: string): Promise<void> {
    return this.service.trashEmail(messageId);
  }

  async deleteEmail(messageId: string): Promise<void> {
    return this.service.deleteEmail(messageId);
  }

  async markAsRead(messageId: string): Promise<void> {
    return this.service.markAsRead(messageId);
  }

  async markAsUnread(messageId: string): Promise<void> {
    return this.service.markAsUnread(messageId);
  }

  async starEmail(messageId: string): Promise<void> {
    return this.service.starEmail(messageId);
  }

  async unstarEmail(messageId: string): Promise<void> {
    return this.service.unstarEmail(messageId);
  }

  async markAsSpam(messageId: string): Promise<void> {
    return this.service.markAsSpam(messageId);
  }

  async removeSpam(messageId: string): Promise<void> {
    return this.service.removeSpam(messageId);
  }

  async modifyLabels(messageId: string, options: ModifyLabelsOptions): Promise<void> {
    return this.service.modifyLabels(messageId, options);
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    return this.service.getAttachment(messageId, attachmentId);
  }

  async getProfile(): Promise<EmailProfile> {
    const profile = await this.service.getProfile();
    return {
      email: profile.email,
      displayName: profile.displayName,
    };
  }
}

/**
 * IMAP provider implementation of IEmailProvider
 * Uses IMAP for fetching/managing emails and SMTP for sending
 */
class ImapProvider implements IEmailProvider {
  readonly provider: EmailProvider = "imap";
  private imapService: ImapService;
  private smtpService: SmtpService;

  constructor(config: ImapConfig) {
    this.imapService = createImapService(config);
    this.smtpService = createSmtpServiceFromImapConfig(config);
  }

  async fetchEmails(options?: FetchEmailsOptions): Promise<FetchEmailsResult> {
    return this.imapService.fetchEmails(options);
  }

  async getEmail(messageId: string): Promise<NormalizedEmail | null> {
    return this.imapService.getEmail(messageId);
  }

  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    return this.smtpService.sendEmail(options);
  }

  async archiveEmail(messageId: string): Promise<void> {
    return this.imapService.archiveEmail(messageId);
  }

  async trashEmail(messageId: string): Promise<void> {
    return this.imapService.trashEmail(messageId);
  }

  async deleteEmail(messageId: string): Promise<void> {
    return this.imapService.deleteEmail(messageId);
  }

  async markAsRead(messageId: string): Promise<void> {
    return this.imapService.markAsRead(messageId);
  }

  async markAsUnread(messageId: string): Promise<void> {
    return this.imapService.markAsUnread(messageId);
  }

  async starEmail(messageId: string): Promise<void> {
    return this.imapService.starEmail(messageId);
  }

  async unstarEmail(messageId: string): Promise<void> {
    return this.imapService.unstarEmail(messageId);
  }

  async markAsSpam(messageId: string): Promise<void> {
    return this.imapService.markAsSpam(messageId);
  }

  async removeSpam(messageId: string): Promise<void> {
    return this.imapService.removeSpam(messageId);
  }

  async modifyLabels(messageId: string, options: ModifyLabelsOptions): Promise<void> {
    return this.imapService.modifyLabels(messageId, options);
  }

  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    return this.imapService.getAttachment(messageId, attachmentId);
  }

  async getProfile(): Promise<EmailProfile> {
    const profile = await this.imapService.getProfile();
    return {
      email: profile.email,
      displayName: profile.displayName,
    };
  }

  /**
   * Disconnect IMAP connection
   * Should be called when the provider is no longer needed
   */
  async disconnect(): Promise<void> {
    await this.imapService.disconnect();
    this.smtpService.close();
  }
}

/**
 * Create an email provider instance based on provider type
 * @param provider - The email provider type ('google', 'microsoft', or 'imap')
 * @param credentials - OAuth tokens for API access (for google/microsoft) or ImapConfig (for imap)
 * @returns An IEmailProvider implementation
 */
export function createEmailProvider(
  provider: EmailProvider,
  credentials: EmailOAuthTokens | ImapConfig
): IEmailProvider {
  switch (provider) {
    case "google":
      return new GmailProvider(credentials as EmailOAuthTokens);
    case "microsoft":
      return new OutlookProvider(credentials as EmailOAuthTokens);
    case "imap":
      return new ImapProvider(credentials as ImapConfig);
    default:
      throw new EmailProviderError(
        `Unsupported email provider: ${provider}`,
        "invalid_request",
        provider as EmailProvider
      );
  }
}

/**
 * Execute an email action with retry support
 * Retries on rate limits and transient errors
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error as Error;

      // Check if we should retry
      if (error instanceof EmailProviderError && !error.isRetryable) {
        throw error;
      }

      // Don't wait after the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying with exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay = Math.min(delay * backoffMultiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Batch execute operations with concurrency control
 * Useful for processing multiple emails without overwhelming the API
 */
export async function batchExecute<T, R>(
  items: T[],
  operation: (item: T) => Promise<R>,
  options: {
    concurrency?: number;
    onProgress?: (completed: number, total: number) => void;
    onError?: (item: T, error: Error) => void;
  } = {}
): Promise<{ results: R[]; errors: Array<{ item: T; error: Error }> }> {
  const { concurrency = 5, onProgress, onError } = options;

  const results: R[] = [];
  const errors: Array<{ item: T; error: Error }> = [];
  let completed = 0;

  // Process items in batches
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map((item) => operation(item))
    );

    for (let j = 0; j < batchResults.length; j++) {
      const result = batchResults[j];
      const item = batch[j];

      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        const error = result.reason as Error;
        errors.push({ item, error });
        onError?.(item, error);
      }

      completed++;
      onProgress?.(completed, items.length);
    }
  }

  return { results, errors };
}

/**
 * Email action types for unified action handling
 */
export type UnifiedEmailAction =
  | { type: "archive"; messageId: string }
  | { type: "trash"; messageId: string }
  | { type: "delete"; messageId: string }
  | { type: "markRead"; messageId: string }
  | { type: "markUnread"; messageId: string }
  | { type: "star"; messageId: string }
  | { type: "unstar"; messageId: string }
  | { type: "spam"; messageId: string }
  | { type: "unspam"; messageId: string };

/**
 * Execute a unified email action on a provider
 */
export async function executeEmailAction(
  provider: IEmailProvider,
  action: UnifiedEmailAction
): Promise<void> {
  switch (action.type) {
    case "archive":
      return provider.archiveEmail(action.messageId);
    case "trash":
      return provider.trashEmail(action.messageId);
    case "delete":
      return provider.deleteEmail(action.messageId);
    case "markRead":
      return provider.markAsRead(action.messageId);
    case "markUnread":
      return provider.markAsUnread(action.messageId);
    case "star":
      return provider.starEmail(action.messageId);
    case "unstar":
      return provider.unstarEmail(action.messageId);
    case "spam":
      return provider.markAsSpam(action.messageId);
    case "unspam":
      return provider.removeSpam(action.messageId);
    default:
      throw new Error(`Unknown action type: ${(action as UnifiedEmailAction).type}`);
  }
}
