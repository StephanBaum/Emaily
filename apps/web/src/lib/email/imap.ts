/**
 * IMAP Email Service
 * Handles fetching and managing emails via IMAP protocol
 */

import { ImapFlow, FetchMessageObject, MailboxObject } from "imapflow";
import { simpleParser, ParsedMail, Attachment } from "mailparser";
import {
  NormalizedEmail,
  EmailAddress,
  EmailAttachment,
  FetchEmailsOptions,
  FetchEmailsResult,
  ModifyLabelsOptions,
  EmailProviderError,
  ImapConfig,
} from "./types";

/**
 * IMAP folder constants
 * Standard IMAP folder names (may vary by server)
 */
export const IMAP_FOLDERS = {
  INBOX: "INBOX",
  SENT: "Sent",
  DRAFTS: "Drafts",
  TRASH: "Trash",
  JUNK: "Junk",
  ARCHIVE: "Archive",
} as const;

/**
 * IMAP service class
 * Provides methods for interacting with IMAP servers
 */
export class ImapService {
  private config: ImapConfig;
  private client: ImapFlow | null = null;

  constructor(config: ImapConfig) {
    this.config = config;
  }

  /**
   * Create and connect IMAP client
   */
  private async getClient(): Promise<ImapFlow> {
    if (this.client && this.client.usable) {
      return this.client;
    }

    this.client = new ImapFlow({
      host: this.config.imapHost,
      port: this.config.imapPort,
      secure: this.config.imapSecure,
      auth: {
        user: this.config.email,
        pass: this.config.password,
      },
      logger: false,
      // Connection timeout of 10 seconds
      connectionTimeout: 10000,
      greetingTimeout: 10000,
    });

    try {
      await this.client.connect();
      return this.client;
    } catch (error) {
      this.client = null;
      throw this.handleError(error, "Failed to connect to IMAP server");
    }
  }

  /**
   * Close IMAP connection
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.logout();
      } catch {
        // Ignore logout errors
      }
      this.client = null;
    }
  }

  /**
   * Fetch emails from IMAP server
   */
  async fetchEmails(options: FetchEmailsOptions = {}): Promise<FetchEmailsResult> {
    const {
      maxResults = 50,
      pageToken,
      labelId = IMAP_FOLDERS.INBOX,
      query,
      includeSpamTrash = false,
    } = options;

    try {
      const client = await this.getClient();

      // Select the mailbox
      const mailbox = await client.getMailboxLock(labelId);

      try {
        const mailboxInfo = await client.status(labelId, { messages: true, uidNext: true });
        const totalMessages = mailboxInfo.messages || 0;

        // Calculate pagination
        const startOffset = pageToken ? parseInt(pageToken, 10) : 0;
        const endOffset = startOffset + maxResults;

        // Build search criteria
        let searchCriteria: Record<string, unknown> = { all: true };
        if (query) {
          // IMAP search by subject or from
          searchCriteria = { or: [{ subject: query }, { from: query }] };
        }

        // Get message UIDs sorted by date (newest first)
        const searchResult = await client.search(searchCriteria, { uid: true });
        const messageUids = searchResult || [];

        // Sort UIDs in descending order (newest first) and paginate
        const sortedUids = Array.isArray(messageUids)
          ? [...messageUids].sort((a, b) => Number(b) - Number(a))
          : [];
        const paginatedUids = sortedUids.slice(startOffset, endOffset);

        // Fetch message details
        const emails: NormalizedEmail[] = [];

        for (const uid of paginatedUids) {
          const email = await this.fetchMessageByUid(client, uid);
          if (email) {
            emails.push(email);
          }
        }

        // Calculate next page token
        const hasMore = endOffset < sortedUids.length;
        const nextPageToken = hasMore ? endOffset.toString() : null;

        return {
          emails,
          nextPageToken,
          resultSizeEstimate: totalMessages,
        };
      } finally {
        mailbox.release();
      }
    } catch (error) {
      if (error instanceof EmailProviderError) {
        throw error;
      }
      throw this.handleError(error, "Failed to fetch emails");
    }
  }

  /**
   * Fetch a single message by UID
   */
  private async fetchMessageByUid(client: ImapFlow, uid: number): Promise<NormalizedEmail | null> {
    try {
      const message = await client.fetchOne(uid.toString(), {
        uid: true,
        flags: true,
        envelope: true,
        bodyStructure: true,
        source: true,
      }, { uid: true });

      if (!message) {
        return null;
      }

      return this.normalizeMessage(message, uid);
    } catch (error) {
      // Return null for individual message fetch failures
      return null;
    }
  }

  /**
   * Get a single email by ID (UID)
   */
  async getEmail(messageId: string): Promise<NormalizedEmail | null> {
    try {
      const client = await this.getClient();
      const mailbox = await client.getMailboxLock(IMAP_FOLDERS.INBOX);

      try {
        const uid = parseInt(messageId, 10);

        const message = await client.fetchOne(messageId, {
          uid: true,
          flags: true,
          envelope: true,
          bodyStructure: true,
          source: true,
        }, { uid: true });

        if (!message) {
          return null;
        }

        return this.normalizeMessage(message, uid);
      } finally {
        mailbox.release();
      }
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }
      throw this.handleError(error, `Failed to get email ${messageId}`);
    }
  }

  /**
   * Archive an email (move to Archive folder)
   */
  async archiveEmail(messageId: string): Promise<void> {
    await this.moveToFolder(messageId, IMAP_FOLDERS.ARCHIVE);
  }

  /**
   * Move email to trash
   */
  async trashEmail(messageId: string): Promise<void> {
    await this.moveToFolder(messageId, IMAP_FOLDERS.TRASH);
  }

  /**
   * Permanently delete an email
   */
  async deleteEmail(messageId: string): Promise<void> {
    try {
      const client = await this.getClient();
      const mailbox = await client.getMailboxLock(IMAP_FOLDERS.INBOX);

      try {
        // Add \Deleted flag
        await client.messageFlagsAdd(messageId, ["\\Deleted"], { uid: true });
        // Expunge to permanently delete
        await client.messageDelete(messageId, { uid: true });
      } finally {
        mailbox.release();
      }
    } catch (error) {
      throw this.handleError(error, `Failed to delete email ${messageId}`);
    }
  }

  /**
   * Mark email as read
   */
  async markAsRead(messageId: string): Promise<void> {
    await this.setFlag(messageId, "\\Seen", true);
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(messageId: string): Promise<void> {
    await this.setFlag(messageId, "\\Seen", false);
  }

  /**
   * Star an email (set \Flagged flag)
   */
  async starEmail(messageId: string): Promise<void> {
    await this.setFlag(messageId, "\\Flagged", true);
  }

  /**
   * Unstar an email (remove \Flagged flag)
   */
  async unstarEmail(messageId: string): Promise<void> {
    await this.setFlag(messageId, "\\Flagged", false);
  }

  /**
   * Mark email as spam (move to Junk folder)
   */
  async markAsSpam(messageId: string): Promise<void> {
    await this.moveToFolder(messageId, IMAP_FOLDERS.JUNK);
  }

  /**
   * Remove spam label from email (move back to Inbox)
   */
  async removeSpam(messageId: string): Promise<void> {
    await this.moveToFolder(messageId, IMAP_FOLDERS.INBOX, IMAP_FOLDERS.JUNK);
  }

  /**
   * Modify labels on an email
   * Note: IMAP uses folders instead of labels, so this moves to a folder
   */
  async modifyLabels(messageId: string, options: ModifyLabelsOptions): Promise<void> {
    // In IMAP, we move to folder if adding labels
    if (options.addLabelIds && options.addLabelIds.length > 0) {
      await this.moveToFolder(messageId, options.addLabelIds[0]);
    }
  }

  /**
   * Get attachment content
   */
  async getAttachment(messageId: string, attachmentId: string): Promise<Buffer> {
    try {
      const client = await this.getClient();
      const mailbox = await client.getMailboxLock(IMAP_FOLDERS.INBOX);

      try {
        // Fetch the full message source
        const message = await client.fetchOne(messageId, {
          source: true,
        }, { uid: true });

        if (!message || !message.source) {
          throw new Error("Message not found");
        }

        // Parse the message to extract attachments
        const parsed = await simpleParser(message.source);

        if (!parsed.attachments || parsed.attachments.length === 0) {
          throw new Error("No attachments found");
        }

        // Find attachment by ID (using content ID or filename as ID)
        const attachment = parsed.attachments.find(
          (att) => att.contentId === attachmentId ||
                   att.filename === attachmentId ||
                   att.checksum === attachmentId
        );

        if (!attachment) {
          throw new Error(`Attachment ${attachmentId} not found`);
        }

        return attachment.content;
      } finally {
        mailbox.release();
      }
    } catch (error) {
      throw this.handleError(error, `Failed to get attachment ${attachmentId}`);
    }
  }

  /**
   * Get user's email profile
   */
  async getProfile(): Promise<{ email: string; displayName: string }> {
    // IMAP doesn't provide user profile information
    // Return the configured email address
    return {
      email: this.config.email,
      displayName: this.config.email.split("@")[0],
    };
  }

  /**
   * List available mailboxes/folders
   */
  async listMailboxes(): Promise<string[]> {
    try {
      const client = await this.getClient();
      const mailboxes = await client.list();
      return mailboxes.map((mb) => mb.path);
    } catch (error) {
      throw this.handleError(error, "Failed to list mailboxes");
    }
  }

  /**
   * Test IMAP connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.getClient();
      // Try to list mailboxes as a connection test
      await client.list();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Move message to a folder
   */
  private async moveToFolder(
    messageId: string,
    targetFolder: string,
    sourceFolder: string = IMAP_FOLDERS.INBOX
  ): Promise<void> {
    try {
      const client = await this.getClient();

      // Ensure target folder exists
      await this.ensureFolderExists(client, targetFolder);

      const mailbox = await client.getMailboxLock(sourceFolder);

      try {
        await client.messageMove(messageId, targetFolder, { uid: true });
      } finally {
        mailbox.release();
      }
    } catch (error) {
      throw this.handleError(error, `Failed to move email ${messageId} to ${targetFolder}`);
    }
  }

  /**
   * Ensure a folder exists, creating it if necessary
   */
  private async ensureFolderExists(client: ImapFlow, folderPath: string): Promise<void> {
    try {
      const mailboxes = await client.list();
      const exists = mailboxes.some((mb) => mb.path === folderPath);

      if (!exists) {
        await client.mailboxCreate(folderPath);
      }
    } catch {
      // Ignore folder creation errors - folder might already exist
    }
  }

  /**
   * Set or remove a flag on a message
   */
  private async setFlag(messageId: string, flag: string, add: boolean): Promise<void> {
    try {
      const client = await this.getClient();
      const mailbox = await client.getMailboxLock(IMAP_FOLDERS.INBOX);

      try {
        if (add) {
          await client.messageFlagsAdd(messageId, [flag], { uid: true });
        } else {
          await client.messageFlagsRemove(messageId, [flag], { uid: true });
        }
      } finally {
        mailbox.release();
      }
    } catch (error) {
      throw this.handleError(error, `Failed to ${add ? "set" : "remove"} flag ${flag} on email ${messageId}`);
    }
  }

  /**
   * Normalize IMAP message to our standard format
   */
  private async normalizeMessage(
    message: FetchMessageObject,
    uid: number
  ): Promise<NormalizedEmail> {
    const envelope = message.envelope;
    const flags = message.flags || new Set<string>();

    // Parse the full message if source is available
    let bodyText = "";
    let bodyHtml: string | null = null;
    let attachments: EmailAttachment[] = [];
    let snippet = "";

    if (message.source) {
      try {
        const parsed = await simpleParser(message.source);
        bodyText = parsed.text || "";
        bodyHtml = parsed.html || null;
        snippet = this.generateSnippet(bodyText);
        attachments = this.extractAttachments(parsed.attachments || []);
      } catch {
        // Fall back to envelope data if parsing fails
        bodyText = "";
      }
    }

    const isRead = flags.has("\\Seen");
    const isStarred = flags.has("\\Flagged");

    return {
      id: uid.toString(),
      threadId: envelope?.messageId || null,
      subject: envelope?.subject || "(No Subject)",
      from: this.parseAddress(envelope?.from?.[0]),
      to: (envelope?.to || []).map((addr) => this.parseAddress(addr)),
      cc: (envelope?.cc || []).map((addr) => this.parseAddress(addr)),
      bcc: (envelope?.bcc || []).map((addr) => this.parseAddress(addr)),
      bodyText,
      bodyHtml,
      snippet,
      isRead,
      isStarred,
      hasAttachments: attachments.length > 0,
      labels: [], // IMAP uses folders, not labels
      receivedAt: envelope?.date ? new Date(envelope.date) : new Date(),
      attachments,
    };
  }

  /**
   * Parse IMAP envelope address to EmailAddress
   */
  private parseAddress(addr?: { name?: string; address?: string }): EmailAddress {
    if (!addr) {
      return { email: "", name: null };
    }
    return {
      email: addr.address || "",
      name: addr.name || null,
    };
  }

  /**
   * Extract attachment metadata from parsed mail
   */
  private extractAttachments(attachments: Attachment[]): EmailAttachment[] {
    return attachments.map((att, index) => ({
      id: att.contentId || att.checksum || `attachment-${index}`,
      filename: att.filename || `attachment-${index}`,
      mimeType: att.contentType || "application/octet-stream",
      size: att.size || 0,
    }));
  }

  /**
   * Generate a short snippet from email body text
   */
  private generateSnippet(bodyText: string, maxLength: number = 200): string {
    if (!bodyText) {
      return "";
    }

    // Remove excessive whitespace and newlines
    const cleaned = bodyText
      .replace(/\s+/g, " ")
      .trim();

    if (cleaned.length <= maxLength) {
      return cleaned;
    }

    return cleaned.substring(0, maxLength - 3) + "...";
  }

  /**
   * Handle IMAP errors
   */
  private handleError(error: unknown, message: string): EmailProviderError {
    if (error instanceof EmailProviderError) {
      return error;
    }

    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorCode = (error as { code?: string })?.code;

    let errorType: EmailProviderError["type"] = "unknown";

    // Classify error types based on error message/code
    if (
      errorMessage.includes("AUTHENTICATIONFAILED") ||
      errorMessage.includes("Invalid credentials") ||
      errorMessage.includes("LOGIN") ||
      errorCode === "AUTHENTICATIONFAILED"
    ) {
      errorType = "authentication";
    } else if (
      errorMessage.includes("AUTHORIZATIONFAILED") ||
      errorMessage.includes("Access denied")
    ) {
      errorType = "authorization";
    } else if (
      errorMessage.includes("NONEXISTENT") ||
      errorMessage.includes("not found") ||
      errorMessage.includes("doesn't exist")
    ) {
      errorType = "not_found";
    } else if (
      errorMessage.includes("Too many") ||
      errorMessage.includes("rate limit") ||
      errorMessage.includes("throttl")
    ) {
      errorType = "rate_limit";
    } else if (
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ETIMEDOUT") ||
      errorMessage.includes("ENOTFOUND") ||
      errorMessage.includes("network") ||
      errorMessage.includes("connection")
    ) {
      errorType = "network_error";
    } else if (
      errorMessage.includes("Invalid") ||
      errorMessage.includes("Bad request")
    ) {
      errorType = "invalid_request";
    } else if (
      errorMessage.includes("server error") ||
      errorMessage.includes("internal error")
    ) {
      errorType = "server_error";
    }

    return new EmailProviderError(
      `${message}: ${errorMessage}`,
      errorType,
      "imap",
      error
    );
  }

  /**
   * Check if error is a not found error
   */
  private isNotFoundError(error: unknown): boolean {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorMessage.includes("NONEXISTENT") ||
      errorMessage.includes("not found") ||
      errorMessage.includes("doesn't exist")
    );
  }
}

/**
 * Create an IMAP service instance from configuration
 */
export function createImapService(config: ImapConfig): ImapService {
  return new ImapService(config);
}

/**
 * Batch fetch emails by IDs
 * More efficient for fetching multiple specific emails
 */
export async function batchFetchImapEmails(
  service: ImapService,
  messageIds: string[]
): Promise<NormalizedEmail[]> {
  const emails = await Promise.all(
    messageIds.map((id) => service.getEmail(id))
  );
  return emails.filter((email): email is NormalizedEmail => email !== null);
}
