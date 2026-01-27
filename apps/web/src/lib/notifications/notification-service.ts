/**
 * Notification Service Orchestrator
 * Unified service for managing push notifications across Gmail and Outlook providers
 */

import { EmailOAuthTokens, EmailProvider, EmailProviderError } from "../email/types";
import {
  GmailPubSubService,
  createGmailPubSubService,
  GmailWatchResponse,
  StartWatchOptions,
} from "./gmail-pubsub";
import {
  OutlookSubscriptionService,
  createOutlookSubscriptionService,
  OutlookSubscriptionResponse,
  CreateSubscriptionOptions,
} from "./outlook-subscriptions";

/**
 * Unified notification subscription response
 */
export interface NotificationSubscriptionResponse {
  /** Subscription ID for managing the subscription */
  subscriptionId: string;
  /** When the subscription expires */
  expiresAt: Date;
  /** Provider-specific data (historyId for Gmail, expirationDateTime for Outlook) */
  providerData: GmailWatchResponse | OutlookSubscriptionResponse;
}

/**
 * Options for enabling notifications
 */
export interface EnableNotificationsOptions {
  /** Email provider type */
  provider: EmailProvider;
  /** OAuth tokens for API access */
  tokens: EmailOAuthTokens;
  /** Provider-specific configuration */
  config: GmailNotificationConfig | OutlookNotificationConfig;
}

/**
 * Gmail-specific notification configuration
 */
export interface GmailNotificationConfig {
  /** Google Cloud Pub/Sub topic name (format: projects/{project}/topics/{topic}) */
  topicName: string;
  /** Label IDs to watch (defaults to INBOX) */
  labelIds?: string[];
}

/**
 * Outlook-specific notification configuration
 */
export interface OutlookNotificationConfig {
  /** Webhook URL to receive notifications (must be publicly accessible with HTTPS) */
  notificationUrl: string;
  /** Subscription expiration in minutes (max ~4230 minutes / ~3 days) */
  expirationMinutes?: number;
}

/**
 * Options for disabling notifications
 */
export interface DisableNotificationsOptions {
  /** Email provider type */
  provider: EmailProvider;
  /** OAuth tokens for API access */
  tokens: EmailOAuthTokens;
  /** Subscription ID (required for Outlook) */
  subscriptionId?: string;
}

/**
 * Options for checking subscription status
 */
export interface CheckSubscriptionOptions {
  /** Email provider type */
  provider: EmailProvider;
  /** Provider-specific expiration data */
  expiration: string;
  /** Hours before expiration to consider "about to expire" (default: 24) */
  bufferHours?: number;
}

/**
 * Subscription status result
 */
export interface SubscriptionStatus {
  /** Whether the subscription is expired or about to expire */
  needsRenewal: boolean;
  /** When the subscription expires */
  expiresAt: Date;
  /** Hours until expiration */
  hoursUntilExpiration: number;
}

/**
 * Result of enabling notifications
 */
export interface EnableNotificationsResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Subscription response with details */
  subscription?: NotificationSubscriptionResponse;
  /** Error if operation failed */
  error?: string;
}

/**
 * Result of disabling notifications
 */
export interface DisableNotificationsResult {
  /** Whether the operation was successful */
  success: boolean;
  /** Error if operation failed */
  error?: string;
}

/**
 * Notification Service
 * Orchestrates push notification management across different email providers
 */
export class NotificationService {
  /**
   * Enable push notifications for an email account
   * Sets up provider-specific subscription (Gmail watch or Outlook Graph subscription)
   *
   * @param options - Configuration for enabling notifications
   * @returns Result with subscription details
   */
  async enableNotifications(
    options: EnableNotificationsOptions
  ): Promise<EnableNotificationsResult> {
    try {
      if (options.provider === "google") {
        return await this.enableGmailNotifications(options);
      } else if (options.provider === "microsoft") {
        return await this.enableOutlookNotifications(options);
      } else {
        return {
          success: false,
          error: `Unsupported provider: ${options.provider}`,
        };
      }
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Disable push notifications for an email account
   * Cancels provider-specific subscription
   *
   * @param options - Configuration for disabling notifications
   * @returns Result of the operation
   */
  async disableNotifications(
    options: DisableNotificationsOptions
  ): Promise<DisableNotificationsResult> {
    try {
      if (options.provider === "google") {
        return await this.disableGmailNotifications(options);
      } else if (options.provider === "microsoft") {
        return await this.disableOutlookNotifications(options);
      } else {
        return {
          success: false,
          error: `Unsupported provider: ${options.provider}`,
        };
      }
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Check subscription status and determine if renewal is needed
   *
   * @param options - Subscription status check options
   * @returns Status information
   */
  checkSubscriptionStatus(options: CheckSubscriptionOptions): SubscriptionStatus {
    const { provider, expiration, bufferHours = 24 } = options;

    if (provider === "google") {
      const service = createGmailPubSubService({ accessToken: "" });
      const needsRenewal = service.isWatchExpired(expiration, bufferHours);
      const expiresAt = service.getExpirationDate(expiration);
      const hoursUntilExpiration = Math.max(
        0,
        (expiresAt.getTime() - Date.now()) / (60 * 60 * 1000)
      );

      return {
        needsRenewal,
        expiresAt,
        hoursUntilExpiration,
      };
    } else if (provider === "microsoft") {
      const service = createOutlookSubscriptionService({ accessToken: "" });
      const needsRenewal = service.isSubscriptionExpired(expiration, bufferHours);
      const expiresAt = service.getExpirationDate(expiration);
      const hoursUntilExpiration = Math.max(
        0,
        (expiresAt.getTime() - Date.now()) / (60 * 60 * 1000)
      );

      return {
        needsRenewal,
        expiresAt,
        hoursUntilExpiration,
      };
    }

    throw new Error(`Unsupported provider: ${provider}`);
  }

  /**
   * Enable Gmail push notifications via Pub/Sub
   * @private
   */
  private async enableGmailNotifications(
    options: EnableNotificationsOptions
  ): Promise<EnableNotificationsResult> {
    const config = options.config as GmailNotificationConfig;
    const service = createGmailPubSubService(options.tokens);

    try {
      const watchOptions: StartWatchOptions = {
        topicName: config.topicName,
        labelIds: config.labelIds,
      };

      const response = await service.startWatch(watchOptions);

      return {
        success: true,
        subscription: {
          subscriptionId: response.historyId,
          expiresAt: service.getExpirationDate(response.expiration),
          providerData: response,
        },
      };
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to enable Gmail notifications",
      };
    }
  }

  /**
   * Enable Outlook push notifications via Graph subscriptions
   * @private
   */
  private async enableOutlookNotifications(
    options: EnableNotificationsOptions
  ): Promise<EnableNotificationsResult> {
    const config = options.config as OutlookNotificationConfig;
    const service = createOutlookSubscriptionService(options.tokens);

    try {
      const subscriptionOptions: CreateSubscriptionOptions = {
        notificationUrl: config.notificationUrl,
        expirationMinutes: config.expirationMinutes,
      };

      const response = await service.createSubscription(subscriptionOptions);

      return {
        success: true,
        subscription: {
          subscriptionId: response.subscriptionId,
          expiresAt: service.getExpirationDate(response.expirationDateTime),
          providerData: response,
        },
      };
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to enable Outlook notifications",
      };
    }
  }

  /**
   * Disable Gmail push notifications
   * @private
   */
  private async disableGmailNotifications(
    options: DisableNotificationsOptions
  ): Promise<DisableNotificationsResult> {
    const service = createGmailPubSubService(options.tokens);

    try {
      await service.stopWatch();
      return { success: true };
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to disable Gmail notifications",
      };
    }
  }

  /**
   * Disable Outlook push notifications
   * @private
   */
  private async disableOutlookNotifications(
    options: DisableNotificationsOptions
  ): Promise<DisableNotificationsResult> {
    if (!options.subscriptionId) {
      return {
        success: false,
        error: "Subscription ID is required for Outlook",
      };
    }

    const service = createOutlookSubscriptionService(options.tokens);

    try {
      await service.deleteSubscription(options.subscriptionId);
      return { success: true };
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to disable Outlook notifications",
      };
    }
  }

  /**
   * Renew an existing subscription
   * Handles renewal for both Gmail and Outlook subscriptions
   *
   * @param options - Renewal configuration
   * @returns Result with new subscription details
   */
  async renewSubscription(
    options: EnableNotificationsOptions & { subscriptionId?: string }
  ): Promise<EnableNotificationsResult> {
    try {
      if (options.provider === "google") {
        const config = options.config as GmailNotificationConfig;
        const service = createGmailPubSubService(options.tokens);

        const watchOptions: StartWatchOptions = {
          topicName: config.topicName,
          labelIds: config.labelIds,
        };

        const response = await service.renewWatch(watchOptions);

        return {
          success: true,
          subscription: {
            subscriptionId: response.historyId,
            expiresAt: service.getExpirationDate(response.expiration),
            providerData: response,
          },
        };
      } else if (options.provider === "microsoft") {
        if (!options.subscriptionId) {
          return {
            success: false,
            error: "Subscription ID is required for Outlook renewal",
          };
        }

        const config = options.config as OutlookNotificationConfig;
        const service = createOutlookSubscriptionService(options.tokens);

        const subscriptionOptions: CreateSubscriptionOptions = {
          notificationUrl: config.notificationUrl,
          expirationMinutes: config.expirationMinutes,
        };

        const response = await service.renewSubscription(options.subscriptionId, subscriptionOptions);

        return {
          success: true,
          subscription: {
            subscriptionId: response.subscriptionId,
            expiresAt: service.getExpirationDate(response.expirationDateTime),
            providerData: response,
          },
        };
      } else {
        return {
          success: false,
          error: `Unsupported provider: ${options.provider}`,
        };
      }
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to renew subscription",
      };
    }
  }
}

/**
 * Create a notification service instance
 *
 * @returns NotificationService instance
 */
export function createNotificationService(): NotificationService {
  return new NotificationService();
}

/**
 * Helper function to determine if a subscription needs renewal
 * Checks expiration and recommends renewal if within buffer period
 *
 * @param provider - Email provider type
 * @param expiration - Provider-specific expiration timestamp
 * @param bufferHours - Hours before expiration to recommend renewal (default: 24)
 * @returns True if renewal is recommended
 */
export function shouldRenewSubscription(
  provider: EmailProvider,
  expiration: string,
  bufferHours: number = 24
): boolean {
  const service = createNotificationService();
  const status = service.checkSubscriptionStatus({
    provider,
    expiration,
    bufferHours,
  });
  return status.needsRenewal;
}
