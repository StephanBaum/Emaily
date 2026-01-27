/**
 * Microsoft Graph API Service for Outlook Emails
 * Handles fetching, sending, and managing emails via Microsoft Graph API
 */

import { Client } from "@microsoft/microsoft-graph-client";
import type { Message, Attachment, MailFolder } from "@microsoft/microsoft-graph-types";
import {
  NormalizedEmail,
  EmailAddress,
  EmailAttachment,
  FetchEmailsOptions,
  FetchEmailsResult,
  SendEmailOptions,
  SendEmailResult,
  EmailOAuthTokens,
  ModifyLabelsOptions,
  EmailProviderError,
  OUTLOOK_FOLDERS,
} from "./types";

/**
 * Microsoft Graph API service class
 * Provides methods for interacting with Outlook/Microsoft 365 mail via Graph API
 */
export class OutlookService {
  private client: Client;

  constructor(private tokens: EmailOAuthTokens) {
    this.client = Client.init({
      authProvider: (done) => {
        done(null, tokens.accessToken);
      },
    });
  }

  /**
   * Fetch emails from Outlook
   */
  async fetchEmails(options: FetchEmailsOptions = {}): Promise<FetchEmailsResult> {
    const {
      maxResults = 50,
      pageToken,
      labelId = OUTLOOK_FOLDERS.INBOX,
      query,
      includeSpamTrash = false,
    } = options;

    try {
      let requestUrl = `/me/mailFolders/${labelId}/messages`;

      // Build query parameters
      const queryParams: string[] = [];
      queryParams.push(`$top=${maxResults}`);
      queryParams.push("$orderby=receivedDateTime desc");
      queryParams.push("$select=id,conversationId,subject,from,toRecipients,ccRecipients,bccRecipients,body,bodyPreview,isRead,flag,hasAttachments,receivedDateTime,parentFolderId");

      if (query) {
        // Microsoft Graph uses OData $filter or $search
        queryParams.push(`$search="${query}"`);
      }

      if (pageToken) {
        // For pagination, Microsoft Graph uses $skip or @odata.nextLink
        // If pageToken is a full URL, use it directly
        if (pageToken.startsWith("http")) {
          const response = await this.client.api(pageToken).get();
          return this.processMessageListResponse(response);
        }
        queryParams.push(`$skip=${pageToken}`);
      }

      requestUrl += "?" + queryParams.join("&");

      const response = await this.client.api(requestUrl).get();
      return this.processMessageListResponse(response);
    } catch (error) {
      throw this.handleError(error, "Failed to fetch emails");
    }
  }

  /**
   * Process message list response from Graph API
   */
  private processMessageListResponse(response: {
    value: Message[];
    "@odata.nextLink"?: string;
    "@odata.count"?: number;
  }): FetchEmailsResult {
    const messages = response.value || [];
    const nextPageToken = response["@odata.nextLink"] || null;

    const emails = messages.map((msg) => this.normalizeMessage(msg));

    return {
      emails,
      nextPageToken,
      resultSizeEstimate: response["@odata.count"],
    };
  }

  /**
   * Get a single email by ID
   */
  async getEmail(messageId: string): Promise<NormalizedEmail | null> {
    try {
      const response = await this.client
        .api(`/me/messages/${messageId}`)
        .select("id,conversationId,subject,from,toRecipients,ccRecipients,bccRecipients,body,bodyPreview,isRead,flag,hasAttachments,receivedDateTime,parentFolderId")
        .expand("attachments")
        .get();

      return this.normalizeMessage(response);
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw this.handleError(error, `Failed to get email ${messageId}`);
    }
  }

  /**
   * Send an email
   */
  async sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
    const {
      to,
      cc = [],
      bcc = [],
      subject,
      bodyText,
      bodyHtml,
      threadId,
      inReplyTo,
      attachments = [],
    } = options;

    try {
      const message: Partial<Message> = {
        subject,
        body: {
          contentType: bodyHtml ? "html" : "text",
          content: bodyHtml || bodyText || "",
        },
        toRecipients: to.map((email) => ({
          emailAddress: { address: email },
        })),
        ccRecipients: cc.map((email) => ({
          emailAddress: { address: email },
        })),
        bccRecipients: bcc.map((email) => ({
          emailAddress: { address: email },
        })),
      };

      // Handle reply
      if (inReplyTo) {
        message.conversationId = threadId;
      }

      // If we have attachments, we need to handle them differently
      if (attachments.length > 0) {
        // Create draft first, add attachments, then send
        const draft = await this.client
          .api("/me/messages")
          .post(message);

        // Add attachments
        for (const attachment of attachments) {
          await this.client
            .api(`/me/messages/${draft.id}/attachments`)
            .post({
              "@odata.type": "#microsoft.graph.fileAttachment",
              name: attachment.filename,
              contentType: attachment.mimeType,
              contentBytes: attachment.content,
            });
        }

        // Send the message
        await this.client
          .api(`/me/messages/${draft.id}/send`)
          .post({});

        return {
          messageId: draft.id,
          threadId: draft.conversationId || draft.id,
          labels: [],
        };
      } else {
        // Send directly without attachments
        const response = await this.client
          .api("/me/sendMail")
          .post({
            message,
            saveToSentItems: true,
          });

        // sendMail doesn't return the message, so we return placeholder
        return {
          messageId: "sent",
          threadId: threadId || "sent",
          labels: ["SENT"],
        };
      }
    } catch (error) {
      throw this.handleError(error, "Failed to send email");
    }
  }

  /**
   * Archive an email (move to Archive folder)
   */
  async archiveEmail(messageId: string): Promise<void> {
    try {
      // Get or create Archive folder ID
      const archiveFolderId = await this.getOrCreateFolder("Archive");

      await this.client
        .api(`/me/messages/${messageId}/move`)
        .post({
          destinationId: archiveFolderId,
        });
    } catch (error) {
      throw this.handleError(error, `Failed to archive email ${messageId}`);
    }
  }

  /**
   * Move email to trash (Deleted Items)
   */
  async trashEmail(messageId: string): Promise<void> {
    try {
      await this.client
        .api(`/me/messages/${messageId}/move`)
        .post({
          destinationId: OUTLOOK_FOLDERS.DELETED,
        });
    } catch (error) {
      throw this.handleError(error, `Failed to trash email ${messageId}`);
    }
  }

  /**
   * Permanently delete an email
   */
  async deleteEmail(messageId: string): Promise<void> {
    try {
      await this.client
        .api(`/me/messages/${messageId}`)
        .delete();
    } catch (error) {
      throw this.handleError(error, `Failed to delete email ${messageId}`);
    }
  }

  /**
   * Mark email as read
   */
  async markAsRead(messageId: string): Promise<void> {
    try {
      await this.client
        .api(`/me/messages/${messageId}`)
        .patch({
          isRead: true,
        });
    } catch (error) {
      throw this.handleError(error, `Failed to mark email ${messageId} as read`);
    }
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(messageId: string): Promise<void> {
    try {
      await this.client
        .api(`/me/messages/${messageId}`)
        .patch({
          isRead: false,
        });
    } catch (error) {
      throw this.handleError(error, `Failed to mark email ${messageId} as unread`);
    }
  }

  /**
   * Flag an email (equivalent to starring in Gmail)
   */
  async starEmail(messageId: string): Promise<void> {
    try {
      await this.client
        .api(`/me/messages/${messageId}`)
        .patch({
          flag: {
            flagStatus: "flagged",
          },
        });
    } catch (error) {
      throw this.handleError(error, `Failed to flag email ${messageId}`);
    }
  }

  /**
   * Remove flag from an email
   */
  async unstarEmail(messageId: string): Promise<void> {
    try {
      await this.client
        .api(`/me/messages/${messageId}`)
        .patch({
          flag: {
            flagStatus: "notFlagged",
          },
        });
    } catch (error) {
      throw this.handleError(error, `Failed to unflag email ${messageId}`);
    }
  }

  /**
   * Mark email as junk (spam)
   */
  async markAsSpam(messageId: string): Promise<void> {
    try {
      await this.client
        .api(`/me/messages/${messageId}/move`)
        .post({
          destinationId: OUTLOOK_FOLDERS.JUNK,
        });
    } catch (error) {
      throw this.handleError(error, `Failed to mark email ${messageId} as spam`);
    }
  }

  /**
   * Move email from junk to inbox
   */
  async removeSpam(messageId: string): Promise<void> {
    try {
      await this.client
        .api(`/me/messages/${messageId}/move`)
        .post({
          destinationId: OUTLOOK_FOLDERS.INBOX,
        });
    } catch (error) {
      throw this.handleError(error, `Failed to remove spam for email ${messageId}`);
    }
  }

  /**
   * Move email to a specific folder
   * Note: Outlook uses folders instead of labels
   */
  async moveToFolder(messageId: string, folderId: string): Promise<void> {
    try {
      await this.client
        .api(`/me/messages/${messageId}/move`)
        .post({
          destinationId: folderId,
        });
    } catch (error) {
      throw this.handleError(error, `Failed to move email ${messageId} to folder`);
    }
  }

  /**
   * Modify labels - maps to folder moves for Outlook
   * Note: Outlook doesn't have labels, so this moves between folders
   */
  async modifyLabels(messageId: string, options: ModifyLabelsOptions): Promise<void> {
    // In Outlook, we can only move to one folder at a time
    // If addLabelIds has a value, move to that folder
    if (options.addLabelIds && options.addLabelIds.length > 0) {
      await this.moveToFolder(messageId, options.addLabelIds[0]);
    }
  }

  /**
   * Get attachment content
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    try {
      const response = await this.client
        .api(`/me/messages/${messageId}/attachments/${attachmentId}`)
        .get();

      const content = response.contentBytes;
      if (!content) {
        throw new Error("No attachment data received");
      }

      return Buffer.from(content, "base64");
    } catch (error) {
      throw this.handleError(error, `Failed to get attachment ${attachmentId}`);
    }
  }

  /**
   * Get list of mail folders
   */
  async getFolders(): Promise<MailFolder[]> {
    try {
      const response = await this.client
        .api("/me/mailFolders")
        .top(100)
        .get();

      return response.value || [];
    } catch (error) {
      throw this.handleError(error, "Failed to get mail folders");
    }
  }

  /**
   * Get or create a folder by name
   */
  private async getOrCreateFolder(folderName: string): Promise<string> {
    try {
      // Try to find existing folder
      const response = await this.client
        .api("/me/mailFolders")
        .filter(`displayName eq '${folderName}'`)
        .get();

      if (response.value && response.value.length > 0) {
        return response.value[0].id;
      }

      // Create the folder if it doesn't exist
      const newFolder = await this.client
        .api("/me/mailFolders")
        .post({
          displayName: folderName,
        });

      return newFolder.id;
    } catch (error) {
      throw this.handleError(error, `Failed to get or create folder ${folderName}`);
    }
  }

  /**
   * Create a Microsoft Graph subscription for push notifications
   */
  async createSubscription(payload: {
    changeType: string;
    notificationUrl: string;
    resource: string;
    expirationDateTime: string;
    clientState?: string;  // Add optional clientState
  }): Promise<{
    subscriptionId: string;
    expirationDateTime: string;
  }> {
    try {
      const response = await this.client
        .api('/subscriptions')
        .post(payload);

      return {
        subscriptionId: response.id,
        expirationDateTime: response.expirationDateTime,
      };
    } catch (error) {
      throw this.handleError(error, "Failed to create subscription");
    }
  }

  /**
   * Delete a subscription
   */
  async deleteSubscription(subscriptionId: string): Promise<void> {
    try {
      await this.client
        .api(`/subscriptions/${subscriptionId}`)
        .delete();
    } catch (error) {
      throw this.handleError(error, `Failed to delete subscription ${subscriptionId}`);
    }
  }

  /**
   * Get an existing subscription by ID
   * Used to check subscription status and expiration
   */
  async getSubscription(subscriptionId: string): Promise<{ subscriptionId: string; expirationDateTime: string }> {
    try {
      const response = await this.client
        .api(`/subscriptions/${subscriptionId}`)
        .get();

      return {
        subscriptionId: response.id,
        expirationDateTime: response.expirationDateTime,
      };
    } catch (error) {
      throw this.handleError(error, `Failed to get subscription ${subscriptionId}`);
    }
  }

  /**
   * Get user's profile
   */
  async getProfile(): Promise<{ email: string; displayName: string }> {
    try {
      const response = await this.client
        .api("/me")
        .select("mail,displayName,userPrincipalName")
        .get();

      return {
        email: response.mail || response.userPrincipalName,
        displayName: response.displayName || "",
      };
    } catch (error) {
      throw this.handleError(error, "Failed to get profile");
    }
  }

  /**
   * Normalize Graph API message to our standard format
   */
  private normalizeMessage(message: Message): NormalizedEmail {
    const attachments = this.extractAttachments(message.attachments || []);
    const isStarred = message.flag?.flagStatus === "flagged";

    return {
      id: message.id!,
      threadId: message.conversationId || null,
      subject: message.subject || "(No Subject)",
      from: this.parseRecipient(message.from),
      to: (message.toRecipients || []).map((r) => this.parseRecipient(r)),
      cc: (message.ccRecipients || []).map((r) => this.parseRecipient(r)),
      bcc: (message.bccRecipients || []).map((r) => this.parseRecipient(r)),
      bodyText: message.body?.contentType === "text" ? message.body.content || "" : this.htmlToText(message.body?.content || ""),
      bodyHtml: message.body?.contentType === "html" ? message.body.content || null : null,
      snippet: message.bodyPreview || "",
      isRead: message.isRead || false,
      isStarred,
      hasAttachments: message.hasAttachments || false,
      labels: message.parentFolderId ? [message.parentFolderId] : [],
      receivedAt: message.receivedDateTime ? new Date(message.receivedDateTime) : new Date(),
      attachments,
    };
  }

  /**
   * Parse a recipient object to EmailAddress
   */
  private parseRecipient(recipient?: { emailAddress?: { address?: string; name?: string } }): EmailAddress {
    if (!recipient?.emailAddress) {
      return { email: "", name: null };
    }
    return {
      email: recipient.emailAddress.address || "",
      name: recipient.emailAddress.name || null,
    };
  }

  /**
   * Extract attachment metadata from message
   */
  private extractAttachments(attachments: Attachment[]): EmailAttachment[] {
    return attachments
      .filter((att): att is Attachment & { id: string; name: string } =>
        att["@odata.type"] === "#microsoft.graph.fileAttachment" && !!att.id && !!att.name
      )
      .map((att) => ({
        id: att.id,
        filename: att.name,
        mimeType: att.contentType || "application/octet-stream",
        size: att.size || 0,
      }));
  }

  /**
   * Simple HTML to text conversion
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Handle Microsoft Graph API errors
   */
  private handleError(error: unknown, message: string): EmailProviderError {
    if (error instanceof EmailProviderError) {
      return error;
    }

    const errorResponse = error as {
      statusCode?: number;
      code?: string;
      message?: string;
      body?: { error?: { code?: string; message?: string } };
    };

    const statusCode = errorResponse?.statusCode;
    const code = errorResponse?.code || errorResponse?.body?.error?.code;
    const errorMessage = errorResponse?.message || errorResponse?.body?.error?.message;

    let errorType: EmailProviderError["type"] = "unknown";

    if (statusCode === 401 || code === "InvalidAuthenticationToken" || code === "AuthenticationError") {
      errorType = "authentication";
    } else if (statusCode === 403 || code === "AccessDenied" || code === "Authorization_RequestDenied") {
      errorType = "authorization";
    } else if (statusCode === 404 || code === "ErrorItemNotFound" || code === "ResourceNotFound") {
      errorType = "not_found";
    } else if (statusCode === 429 || code === "TooManyRequests" || code === "ApplicationThrottled") {
      errorType = "rate_limit";
    } else if (statusCode === 400 || code === "BadRequest" || code === "InvalidRequest") {
      errorType = "invalid_request";
    } else if (statusCode && statusCode >= 500) {
      errorType = "server_error";
    } else if (errorMessage?.includes("network") || errorMessage?.includes("ECONNREFUSED")) {
      errorType = "network_error";
    }

    return new EmailProviderError(
      `${message}: ${errorMessage || "Unknown error"}`,
      errorType,
      "microsoft",
      error
    );
  }

  /**
   * Check if error is a not found error
   */
  private isNotFoundError(error: unknown): boolean {
    const errorResponse = error as { statusCode?: number; code?: string };
    return errorResponse?.statusCode === 404 || errorResponse?.code === "ErrorItemNotFound";
  }
}

/**
 * Create an Outlook service instance from OAuth tokens
 */
export function createOutlookService(tokens: EmailOAuthTokens): OutlookService {
  return new OutlookService(tokens);
}

/**
 * Batch fetch emails by IDs
 * More efficient for fetching multiple specific emails
 */
export async function batchFetchOutlookEmails(
  service: OutlookService,
  messageIds: string[]
): Promise<NormalizedEmail[]> {
  const emails = await Promise.all(
    messageIds.map((id) => service.getEmail(id))
  );
  return emails.filter((email): email is NormalizedEmail => email !== null);
}
