/**
 * Gmail Pub/Sub Service
 * Handles Gmail push notifications via Google Cloud Pub/Sub
 */

import { GmailService, createGmailService } from "../email/gmail";
import { EmailOAuthTokens, EmailProviderError } from "../email/types";

/**
 * Gmail watch subscription response
 */
export interface GmailWatchResponse {
  /** History ID to track changes from */
  historyId: string;
  /** Unix timestamp (milliseconds) when the watch expires */
  expiration: string;
}

/**
 * Options for starting a Gmail watch
 */
export interface StartWatchOptions {
  /** Google Cloud Pub/Sub topic name (format: projects/{project}/topics/{topic}) */
  topicName: string;
  /** Label IDs to watch (defaults to INBOX) */
  labelIds?: string[];
}

/**
 * Gmail Pub/Sub service class
 * Provides methods for managing Gmail push notification subscriptions
 */
export class GmailPubSubService {
  private gmailService: GmailService;

  constructor(private tokens: EmailOAuthTokens) {
    this.gmailService = createGmailService(tokens);
  }

  /**
   * Start watching Gmail inbox for new messages
   * Sets up push notifications via Google Cloud Pub/Sub
   *
   * @param options - Watch configuration options
   * @returns Watch response with historyId and expiration
   * @throws EmailProviderError if watch setup fails
   */
  async startWatch(options: StartWatchOptions): Promise<GmailWatchResponse> {
    try {
      const response = await this.gmailService.watchInbox(options.topicName);
      return response;
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      throw new EmailProviderError(
        `Failed to start Gmail watch: ${error instanceof Error ? error.message : "Unknown error"}`,
        "server_error",
        "google",
        error
      );
    }
  }

  /**
   * Stop watching Gmail inbox
   * Cancels the current push notification subscription
   *
   * @throws EmailProviderError if stop operation fails
   */
  async stopWatch(): Promise<void> {
    try {
      await this.gmailService.stopWatch();
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      throw new EmailProviderError(
        `Failed to stop Gmail watch: ${error instanceof Error ? error.message : "Unknown error"}`,
        "server_error",
        "google",
        error
      );
    }
  }

  /**
   * Renew Gmail watch subscription
   * Watches expire after 7 days, so they need to be renewed periodically
   *
   * @param options - Watch configuration options (same as startWatch)
   * @returns New watch response with updated historyId and expiration
   * @throws EmailProviderError if renewal fails
   */
  async renewWatch(options: StartWatchOptions): Promise<GmailWatchResponse> {
    try {
      // Stop the existing watch first (Gmail API doesn't have explicit renewal)
      // Then start a new watch - this is the recommended approach
      await this.stopWatch().catch(() => {
        // Ignore errors if watch is already stopped or expired
      });

      // Start a new watch
      const response = await this.startWatch(options);
      return response;
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      throw new EmailProviderError(
        `Failed to renew Gmail watch: ${error instanceof Error ? error.message : "Unknown error"}`,
        "server_error",
        "google",
        error
      );
    }
  }

  /**
   * Get the expiration date from a watch response
   *
   * @param expiration - Expiration timestamp from watch response (milliseconds)
   * @returns Date object representing when the watch expires
   */
  getExpirationDate(expiration: string): Date {
    return new Date(parseInt(expiration, 10));
  }

  /**
   * Check if a watch subscription is expired or about to expire
   *
   * @param expiration - Expiration timestamp from watch response (milliseconds)
   * @param bufferHours - Hours before expiration to consider "about to expire" (default: 24)
   * @returns True if expired or within buffer period
   */
  isWatchExpired(expiration: string, bufferHours: number = 24): boolean {
    const expirationDate = this.getExpirationDate(expiration);
    const bufferMs = bufferHours * 60 * 60 * 1000;
    const expirationWithBuffer = expirationDate.getTime() - bufferMs;
    return Date.now() >= expirationWithBuffer;
  }
}

/**
 * Create a Gmail Pub/Sub service instance from OAuth tokens
 *
 * @param tokens - OAuth tokens for Gmail API access
 * @returns GmailPubSubService instance
 */
export function createGmailPubSubService(tokens: EmailOAuthTokens): GmailPubSubService {
  return new GmailPubSubService(tokens);
}

/**
 * Build a Google Cloud Pub/Sub topic name
 *
 * @param projectId - Google Cloud project ID
 * @param topicName - Pub/Sub topic name
 * @returns Fully qualified topic name (projects/{project}/topics/{topic})
 */
export function buildPubSubTopicName(projectId: string, topicName: string): string {
  return `projects/${projectId}/topics/${topicName}`;
}
