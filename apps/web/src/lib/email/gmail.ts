/**
 * Gmail API Service
 * Handles fetching, sending, and managing emails via Gmail API
 */

import { google, gmail_v1 } from "googleapis";
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
  GMAIL_LABELS,
} from "./types";

/**
 * Gmail API service class
 * Provides methods for interacting with Gmail API using OAuth tokens
 */
export class GmailService {
  private gmail: gmail_v1.Gmail;
  private oauth2Client: ReturnType<typeof google.auth.OAuth2.prototype>;

  constructor(private tokens: EmailOAuthTokens) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    this.oauth2Client.setCredentials({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken,
      expiry_date: tokens.expiresAt,
    });

    this.gmail = google.gmail({ version: "v1", auth: this.oauth2Client });
  }

  /**
   * Fetch emails from Gmail
   */
  async fetchEmails(options: FetchEmailsOptions = {}): Promise<FetchEmailsResult> {
    const {
      maxResults = 50,
      pageToken,
      labelId = GMAIL_LABELS.INBOX,
      query,
      includeSpamTrash = false,
    } = options;

    try {
      // First, list message IDs
      const listResponse = await this.gmail.users.messages.list({
        userId: "me",
        maxResults,
        pageToken,
        labelIds: labelId ? [labelId] : undefined,
        q: query,
        includeSpamTrash,
      });

      const messages = listResponse.data.messages || [];
      const nextPageToken = listResponse.data.nextPageToken || null;
      const resultSizeEstimate = listResponse.data.resultSizeEstimate;

      // Fetch full message details in parallel
      const emailPromises = messages.map((msg) =>
        this.getEmail(msg.id!)
      );
      const emails = await Promise.all(emailPromises);

      return {
        emails: emails.filter((email): email is NormalizedEmail => email !== null),
        nextPageToken,
        resultSizeEstimate,
      };
    } catch (error) {
      throw this.handleError(error, "Failed to fetch emails");
    }
  }

  /**
   * Get a single email by ID
   */
  async getEmail(messageId: string): Promise<NormalizedEmail | null> {
    try {
      const response = await this.gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      return this.normalizeMessage(response.data);
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
      // Build the raw email message
      const rawMessage = this.buildRawMessage({
        to,
        cc,
        bcc,
        subject,
        bodyText,
        bodyHtml,
        inReplyTo,
        attachments,
      });

      const response = await this.gmail.users.messages.send({
        userId: "me",
        requestBody: {
          raw: rawMessage,
          threadId,
        },
      });

      return {
        messageId: response.data.id!,
        threadId: response.data.threadId!,
        labels: response.data.labelIds || [],
      };
    } catch (error) {
      throw this.handleError(error, "Failed to send email");
    }
  }

  /**
   * Archive an email (remove from INBOX)
   */
  async archiveEmail(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, {
      removeLabelIds: [GMAIL_LABELS.INBOX],
    });
  }

  /**
   * Move email to trash
   */
  async trashEmail(messageId: string): Promise<void> {
    try {
      await this.gmail.users.messages.trash({
        userId: "me",
        id: messageId,
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
      await this.gmail.users.messages.delete({
        userId: "me",
        id: messageId,
      });
    } catch (error) {
      throw this.handleError(error, `Failed to delete email ${messageId}`);
    }
  }

  /**
   * Mark email as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, {
      removeLabelIds: [GMAIL_LABELS.UNREAD],
    });
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, {
      addLabelIds: [GMAIL_LABELS.UNREAD],
    });
  }

  /**
   * Star an email
   */
  async starEmail(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, {
      addLabelIds: [GMAIL_LABELS.STARRED],
    });
  }

  /**
   * Unstar an email
   */
  async unstarEmail(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, {
      removeLabelIds: [GMAIL_LABELS.STARRED],
    });
  }

  /**
   * Mark email as spam
   */
  async markAsSpam(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, {
      addLabelIds: [GMAIL_LABELS.SPAM],
      removeLabelIds: [GMAIL_LABELS.INBOX],
    });
  }

  /**
   * Remove spam label from email
   */
  async removeSpam(messageId: string): Promise<void> {
    await this.modifyLabels(messageId, {
      addLabelIds: [GMAIL_LABELS.INBOX],
      removeLabelIds: [GMAIL_LABELS.SPAM],
    });
  }

  /**
   * Modify labels on an email
   */
  async modifyLabels(messageId: string, options: ModifyLabelsOptions): Promise<void> {
    try {
      await this.gmail.users.messages.modify({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: options.addLabelIds,
          removeLabelIds: options.removeLabelIds,
        },
      });
    } catch (error) {
      throw this.handleError(error, `Failed to modify labels for email ${messageId}`);
    }
  }

  /**
   * Get attachment content
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    try {
      const response = await this.gmail.users.messages.attachments.get({
        userId: "me",
        messageId,
        id: attachmentId,
      });

      const data = response.data.data;
      if (!data) {
        throw new Error("No attachment data received");
      }

      // Convert from URL-safe base64 to Buffer
      return Buffer.from(data, "base64");
    } catch (error) {
      throw this.handleError(error, `Failed to get attachment ${attachmentId}`);
    }
  }

  /**
   * Watch for new emails (set up push notifications)
   * Note: Requires Google Cloud Pub/Sub setup
   */
  async watchInbox(topicName: string): Promise<{ historyId: string; expiration: string }> {
    try {
      const response = await this.gmail.users.watch({
        userId: "me",
        requestBody: {
          topicName,
          labelIds: [GMAIL_LABELS.INBOX],
        },
      });

      return {
        historyId: response.data.historyId!,
        expiration: response.data.expiration!,
      };
    } catch (error) {
      throw this.handleError(error, "Failed to set up inbox watch");
    }
  }

  /**
   * Stop watching for emails
   */
  async stopWatch(): Promise<void> {
    try {
      await this.gmail.users.stop({
        userId: "me",
      });
    } catch (error) {
      throw this.handleError(error, "Failed to stop inbox watch");
    }
  }

  /**
   * Get user's email profile
   */
  async getProfile(): Promise<{ email: string; messagesTotal: number; threadsTotal: number }> {
    try {
      const response = await this.gmail.users.getProfile({
        userId: "me",
      });

      return {
        email: response.data.emailAddress!,
        messagesTotal: response.data.messagesTotal || 0,
        threadsTotal: response.data.threadsTotal || 0,
      };
    } catch (error) {
      throw this.handleError(error, "Failed to get profile");
    }
  }

  /**
   * Normalize Gmail message to our standard format
   */
  private normalizeMessage(message: gmail_v1.Schema$Message): NormalizedEmail {
    const headers = this.extractHeaders(message.payload?.headers || []);
    const { bodyText, bodyHtml } = this.extractBody(message.payload);
    const attachments = this.extractAttachments(message.payload);
    const labels = message.labelIds || [];

    return {
      id: message.id!,
      threadId: message.threadId || null,
      subject: headers.subject || "(No Subject)",
      from: this.parseEmailAddress(headers.from || ""),
      to: this.parseEmailAddresses(headers.to || ""),
      cc: this.parseEmailAddresses(headers.cc || ""),
      bcc: this.parseEmailAddresses(headers.bcc || ""),
      bodyText,
      bodyHtml,
      snippet: message.snippet || "",
      isRead: !labels.includes(GMAIL_LABELS.UNREAD),
      isStarred: labels.includes(GMAIL_LABELS.STARRED),
      hasAttachments: attachments.length > 0,
      labels,
      receivedAt: new Date(parseInt(message.internalDate || "0", 10)),
      attachments,
    };
  }

  /**
   * Extract headers from message payload
   */
  private extractHeaders(headers: gmail_v1.Schema$MessagePartHeader[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const header of headers) {
      if (header.name && header.value) {
        result[header.name.toLowerCase()] = header.value;
      }
    }
    return result;
  }

  /**
   * Extract body content from message payload
   */
  private extractBody(payload?: gmail_v1.Schema$MessagePart): { bodyText: string; bodyHtml: string | null } {
    let bodyText = "";
    let bodyHtml: string | null = null;

    if (!payload) {
      return { bodyText, bodyHtml };
    }

    const extractFromPart = (part: gmail_v1.Schema$MessagePart) => {
      if (part.body?.data) {
        const content = Buffer.from(part.body.data, "base64").toString("utf-8");
        if (part.mimeType === "text/plain") {
          bodyText = content;
        } else if (part.mimeType === "text/html") {
          bodyHtml = content;
        }
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          extractFromPart(subPart);
        }
      }
    };

    extractFromPart(payload);

    return { bodyText, bodyHtml };
  }

  /**
   * Extract attachment metadata from message payload
   */
  private extractAttachments(payload?: gmail_v1.Schema$MessagePart): EmailAttachment[] {
    const attachments: EmailAttachment[] = [];

    if (!payload) {
      return attachments;
    }

    const extractFromPart = (part: gmail_v1.Schema$MessagePart) => {
      if (part.body?.attachmentId && part.filename) {
        attachments.push({
          id: part.body.attachmentId,
          filename: part.filename,
          mimeType: part.mimeType || "application/octet-stream",
          size: part.body.size || 0,
        });
      }

      if (part.parts) {
        for (const subPart of part.parts) {
          extractFromPart(subPart);
        }
      }
    };

    extractFromPart(payload);

    return attachments;
  }

  /**
   * Parse a single email address string
   */
  private parseEmailAddress(address: string): EmailAddress {
    // Match "Name <email@example.com>" or "email@example.com"
    const match = address.match(/^(?:"?([^"]*)"?\s)?<?([^>]+@[^>]+)>?$/);
    if (match) {
      return {
        name: match[1]?.trim() || null,
        email: match[2].trim(),
      };
    }
    return {
      name: null,
      email: address.trim(),
    };
  }

  /**
   * Parse multiple email addresses from a comma-separated string
   */
  private parseEmailAddresses(addresses: string): EmailAddress[] {
    if (!addresses) return [];

    // Split by comma, but be careful with commas inside quoted names
    const parts: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of addresses) {
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === "," && !inQuotes) {
        parts.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    if (current.trim()) {
      parts.push(current.trim());
    }

    return parts.map((part) => this.parseEmailAddress(part));
  }

  /**
   * Build raw MIME message for sending
   */
  private buildRawMessage(options: {
    to: string[];
    cc: string[];
    bcc: string[];
    subject: string;
    bodyText?: string;
    bodyHtml?: string;
    inReplyTo?: string;
    attachments: SendEmailOptions["attachments"];
  }): string {
    const { to, cc, bcc, subject, bodyText, bodyHtml, inReplyTo, attachments = [] } = options;

    const boundary = `boundary_${Date.now()}_${Math.random().toString(36).substr(2)}`;
    const headers: string[] = [];

    headers.push(`To: ${to.join(", ")}`);
    if (cc.length > 0) {
      headers.push(`Cc: ${cc.join(", ")}`);
    }
    if (bcc.length > 0) {
      headers.push(`Bcc: ${bcc.join(", ")}`);
    }
    headers.push(`Subject: =?UTF-8?B?${Buffer.from(subject).toString("base64")}?=`);
    headers.push("MIME-Version: 1.0");

    if (inReplyTo) {
      headers.push(`In-Reply-To: ${inReplyTo}`);
      headers.push(`References: ${inReplyTo}`);
    }

    const hasAttachments = attachments && attachments.length > 0;
    const hasHtml = !!bodyHtml;

    if (hasAttachments) {
      headers.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
    } else if (hasHtml) {
      headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
    } else {
      headers.push("Content-Type: text/plain; charset=UTF-8");
      headers.push("Content-Transfer-Encoding: base64");
    }

    let message = headers.join("\r\n") + "\r\n\r\n";

    if (hasAttachments || hasHtml) {
      // Plain text part
      if (bodyText) {
        message += `--${boundary}\r\n`;
        message += "Content-Type: text/plain; charset=UTF-8\r\n";
        message += "Content-Transfer-Encoding: base64\r\n\r\n";
        message += Buffer.from(bodyText).toString("base64") + "\r\n";
      }

      // HTML part
      if (bodyHtml) {
        message += `--${boundary}\r\n`;
        message += "Content-Type: text/html; charset=UTF-8\r\n";
        message += "Content-Transfer-Encoding: base64\r\n\r\n";
        message += Buffer.from(bodyHtml).toString("base64") + "\r\n";
      }

      // Attachments
      if (attachments) {
        for (const attachment of attachments) {
          message += `--${boundary}\r\n`;
          message += `Content-Type: ${attachment.mimeType}; name="${attachment.filename}"\r\n`;
          message += `Content-Disposition: attachment; filename="${attachment.filename}"\r\n`;
          message += "Content-Transfer-Encoding: base64\r\n\r\n";
          message += attachment.content + "\r\n";
        }
      }

      message += `--${boundary}--`;
    } else {
      message += Buffer.from(bodyText || "").toString("base64");
    }

    // Convert to URL-safe base64
    return Buffer.from(message)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  /**
   * Handle Gmail API errors
   */
  private handleError(error: unknown, message: string): EmailProviderError {
    if (error instanceof EmailProviderError) {
      return error;
    }

    const errorResponse = error as { code?: number; message?: string; errors?: Array<{ reason?: string }> };
    const code = errorResponse?.code;
    const reason = errorResponse?.errors?.[0]?.reason;

    let errorType: EmailProviderError["type"] = "unknown";

    if (code === 401 || reason === "authError") {
      errorType = "authentication";
    } else if (code === 403 || reason === "forbidden" || reason === "insufficientPermissions") {
      errorType = "authorization";
    } else if (code === 404 || reason === "notFound") {
      errorType = "not_found";
    } else if (code === 429 || reason === "rateLimitExceeded" || reason === "userRateLimitExceeded") {
      errorType = "rate_limit";
    } else if (code === 400 || reason === "invalidArgument") {
      errorType = "invalid_request";
    } else if (code && code >= 500) {
      errorType = "server_error";
    } else if (errorResponse?.message?.includes("network") || errorResponse?.message?.includes("ECONNREFUSED")) {
      errorType = "network_error";
    }

    return new EmailProviderError(
      `${message}: ${errorResponse?.message || "Unknown error"}`,
      errorType,
      "google",
      error
    );
  }

  /**
   * Check if error is a not found error
   */
  private isNotFoundError(error: unknown): boolean {
    const errorResponse = error as { code?: number };
    return errorResponse?.code === 404;
  }
}

/**
 * Create a Gmail service instance from OAuth tokens
 */
export function createGmailService(tokens: EmailOAuthTokens): GmailService {
  return new GmailService(tokens);
}

/**
 * Batch fetch emails by IDs
 * More efficient for fetching multiple specific emails
 */
export async function batchFetchEmails(
  service: GmailService,
  messageIds: string[]
): Promise<NormalizedEmail[]> {
  const emails = await Promise.all(
    messageIds.map((id) => service.getEmail(id))
  );
  return emails.filter((email): email is NormalizedEmail => email !== null);
}
