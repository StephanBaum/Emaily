/**
 * Microsoft Graph Subscription Service
 * Handles Outlook push notifications via Microsoft Graph API subscriptions
 */

import { OutlookService, createOutlookService } from "../email/outlook";
import { EmailOAuthTokens, EmailProviderError } from "../email/types";

/**
 * Microsoft Graph subscription response
 */
export interface OutlookSubscriptionResponse {
  /** Subscription ID for managing the subscription */
  subscriptionId: string;
  /** ISO 8601 timestamp when the subscription expires */
  expirationDateTime: string;
}

/**
 * Options for creating an Outlook subscription
 */
export interface CreateSubscriptionOptions {
  /** Webhook URL to receive notifications (must be publicly accessible with HTTPS) */
  notificationUrl: string;
  /** Subscription expiration in minutes (max ~4230 minutes / ~3 days) */
  expirationMinutes?: number;
  /** Resource to subscribe to (defaults to inbox messages) */
  resource?: string;
  /** Change types to watch (defaults to created,updated) */
  changeType?: string;
}

/**
 * Microsoft Graph subscription service class
 * Provides methods for managing Outlook push notification subscriptions
 */
export class OutlookSubscriptionService {
  private outlookService: OutlookService;

  constructor(private tokens: EmailOAuthTokens) {
    this.outlookService = createOutlookService(tokens);
  }

  /**
   * Create a new Microsoft Graph subscription for inbox messages
   * Sets up push notifications to be delivered to the specified webhook URL
   *
   * @param options - Subscription configuration options
   * @returns Subscription response with ID and expiration
   * @throws EmailProviderError if subscription creation fails
   */
  async createSubscription(options: CreateSubscriptionOptions): Promise<OutlookSubscriptionResponse> {
    const {
      notificationUrl,
      expirationMinutes = 4230, // Default ~3 days (max allowed by Microsoft Graph)
      resource = "me/mailFolders/inbox/messages",
      changeType = "created,updated",
    } = options;

    try {
      // Calculate expiration (max ~3 days)
      const expirationDateTime = new Date();
      expirationDateTime.setMinutes(
        expirationDateTime.getMinutes() + Math.min(expirationMinutes, 4230)
      );

      // Get clientState from environment for webhook authentication
      const clientState = process.env.OUTLOOK_CLIENT_STATE;

      // Create subscription payload
      const subscriptionPayload: any = {
        changeType,
        notificationUrl,
        resource,
        expirationDateTime: expirationDateTime.toISOString(),
      };

      // Add clientState if configured (recommended for security)
      if (clientState) {
        subscriptionPayload.clientState = clientState;
      } else {
        console.warn('OUTLOOK_CLIENT_STATE not configured - subscriptions will not include clientState verification');
      }

      const response = await this.outlookService.createSubscription(
        subscriptionPayload
      );
      return response;
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      throw new EmailProviderError(
        `Failed to create Outlook subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
        "server_error",
        "microsoft",
        error
      );
    }
  }

  /**
   * Delete an existing Microsoft Graph subscription
   * Cancels the push notification subscription
   *
   * @param subscriptionId - ID of the subscription to delete
   * @throws EmailProviderError if deletion fails
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.outlookService.deleteSubscription(subscriptionId);
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      throw new EmailProviderError(
        `Failed to delete Outlook subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
        "server_error",
        "microsoft",
        error
      );
    }
  }

  /**
   * Renew Microsoft Graph subscription
   * Subscriptions expire after ~3 days, so they need to be renewed periodically
   *
   * @param subscriptionId - ID of the existing subscription to renew
   * @param options - Subscription configuration options (same as createSubscription)
   * @returns New subscription response with updated expiration
   * @throws EmailProviderError if renewal fails
   */
  async renewSubscription(
    subscriptionId: string,
    options: CreateSubscriptionOptions
  ): Promise<OutlookSubscriptionResponse> {
    try {
      // Delete the existing subscription first
      await this.deleteSubscription(subscriptionId).catch(() => {
        // Ignore errors if subscription is already deleted or expired
      });

      // Create a new subscription with the same configuration
      const response = await this.createSubscription(options);
      return response;
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      throw new EmailProviderError(
        `Failed to renew Outlook subscription: ${error instanceof Error ? error.message : "Unknown error"}`,
        "server_error",
        "microsoft",
        error
      );
    }
  }

  /**
   * Get the expiration date from a subscription response
   *
   * @param expirationDateTime - ISO 8601 timestamp from subscription response
   * @returns Date object representing when the subscription expires
   */
  getExpirationDate(expirationDateTime: string): Date {
    return new Date(expirationDateTime);
  }

  /**
   * Check if a subscription is expired or about to expire
   *
   * @param expirationDateTime - ISO 8601 timestamp from subscription response
   * @param bufferHours - Hours before expiration to consider "about to expire" (default: 24)
   * @returns True if expired or within buffer period
   */
  isSubscriptionExpired(expirationDateTime: string, bufferHours: number = 24): boolean {
    const expirationDate = this.getExpirationDate(expirationDateTime);
    const bufferMs = bufferHours * 60 * 60 * 1000;
    const expirationWithBuffer = expirationDate.getTime() - bufferMs;
    return Date.now() >= expirationWithBuffer;
  }

  /**
   * Calculate the recommended renewal time for a subscription
   * Returns a date that is 24 hours before expiration
   *
   * @param expirationDateTime - ISO 8601 timestamp from subscription response
   * @returns Date object representing when to renew the subscription
   */
  getRecommendedRenewalDate(expirationDateTime: string): Date {
    const expirationDate = this.getExpirationDate(expirationDateTime);
    const bufferMs = 24 * 60 * 60 * 1000; // 24 hours
    return new Date(expirationDate.getTime() - bufferMs);
  }

  /**
   * Check the status of an existing Microsoft Graph subscription
   * Retrieves subscription details from Microsoft Graph API
   *
   * @param subscriptionId - ID of the subscription to check
   * @returns Subscription status with active state, expiration, and renewal recommendation
   * @throws EmailProviderError if status check fails
   */
  async checkSubscriptionStatus(subscriptionId: string): Promise<{
    active: boolean;
    expiresAt: Date;
    needsRenewal: boolean;
    subscriptionId?: string;
  }> {
    try {
      const subscription = await this.outlookService.getSubscription(subscriptionId);
      const expiresAt = this.getExpirationDate(subscription.expirationDateTime);
      const needsRenewal = this.isSubscriptionExpired(subscription.expirationDateTime);

      return {
        active: true,
        expiresAt,
        needsRenewal,
        subscriptionId: subscription.subscriptionId,
      };
    } catch (error) {
      // If subscription not found, it's inactive
      if (error instanceof EmailProviderError && error.type === "not_found") {
        return {
          active: false,
          expiresAt: new Date(),
          needsRenewal: true,
        };
      }

      if (error instanceof EmailProviderError) {
        throw error;
      }

      throw new EmailProviderError(
        `Failed to check Outlook subscription status: ${error instanceof Error ? error.message : "Unknown error"}`,
        "server_error",
        "microsoft",
        error
      );
    }
  }
}

/**
 * Create an Outlook subscription service instance from OAuth tokens
 *
 * @param tokens - OAuth tokens for Microsoft Graph API access
 * @returns OutlookSubscriptionService instance
 */
export function createOutlookSubscriptionService(tokens: EmailOAuthTokens): OutlookSubscriptionService {
  return new OutlookSubscriptionService(tokens);
}

/**
 * Build a webhook URL for Outlook notifications
 * Helper function to construct the full webhook URL
 *
 * @param baseUrl - Base URL of your application (e.g., "https://example.com")
 * @param userId - User ID to include in the webhook path
 * @returns Full webhook URL for Outlook notifications
 */
export function buildOutlookWebhookUrl(baseUrl: string, userId?: string): string {
  const path = userId ? `/api/webhooks/outlook?userId=${userId}` : "/api/webhooks/outlook";
  return `${baseUrl}${path}`;
}
