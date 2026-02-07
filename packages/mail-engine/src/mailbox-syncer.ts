import { ImapClient, ImapConfig, FetchedEmail } from "./imap-client";
import {
  matchEmailToThread,
  normalizeSubject,
  isLikelyBot,
  ThreadInfo,
} from "./thread-matcher";

export interface SyncResult {
  folder: string;
  newEmails: number;
  newThreads: number;
  updatedThreads: number;
  errors: string[];
  lastUid: number;
}

export interface MailboxSyncState {
  folderName: string;
  lastUid: number;
  lastSyncAt: Date | null;
}

export interface EmailToStore {
  uid: number;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  fromAddress: string;
  fromName: string;
  toAddresses: string[];
  ccAddresses: string[];
  date: Date;
  folder: string;
  isBot: boolean;
  headers: Record<string, string>;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }>;
}

export interface ThreadToCreate {
  subject: string;
  emails: EmailToStore[];
}

export interface SyncCallbacks {
  /**
   * Get existing threads for matching
   */
  getExistingThreads: (mailboxId: string) => Promise<ThreadInfo[]>;

  /**
   * Store a new email in an existing thread
   */
  addEmailToThread: (
    threadId: string,
    email: EmailToStore
  ) => Promise<void>;

  /**
   * Create a new thread with initial email
   */
  createThread: (
    mailboxId: string,
    teamId: string,
    thread: ThreadToCreate
  ) => Promise<string>;

  /**
   * Update sync state
   */
  updateSyncState: (
    mailboxId: string,
    state: MailboxSyncState
  ) => Promise<void>;

  /**
   * Get current sync state
   */
  getSyncState: (
    mailboxId: string,
    folder: string
  ) => Promise<MailboxSyncState | null>;
}

export class MailboxSyncer {
  private imapClient: ImapClient;
  private mailboxId: string;
  private teamId: string;
  private callbacks: SyncCallbacks;

  constructor(
    imapConfig: ImapConfig,
    mailboxId: string,
    teamId: string,
    callbacks: SyncCallbacks
  ) {
    this.imapClient = new ImapClient(imapConfig);
    this.mailboxId = mailboxId;
    this.teamId = teamId;
    this.callbacks = callbacks;
  }

  /**
   * Sync a specific folder
   */
  async syncFolder(folder: string = "INBOX"): Promise<SyncResult> {
    const result: SyncResult = {
      folder,
      newEmails: 0,
      newThreads: 0,
      updatedThreads: 0,
      errors: [],
      lastUid: 0,
    };

    try {
      await this.imapClient.connect();

      // Get current sync state
      const syncState = await this.callbacks.getSyncState(this.mailboxId, folder);
      const lastUid = syncState?.lastUid ?? 0;

      // Fetch new emails since last sync
      const emails = await this.imapClient.fetchEmailsSinceUid(folder, lastUid + 1);

      if (emails.length === 0) {
        result.lastUid = lastUid;
        return result;
      }

      // Get existing threads for matching
      const existingThreads = await this.callbacks.getExistingThreads(this.mailboxId);

      // Process each email
      for (const email of emails) {
        try {
          await this.processEmail(email, folder, existingThreads, result);
          result.lastUid = Math.max(result.lastUid, email.uid);
        } catch (error) {
          result.errors.push(
            `Failed to process email ${email.uid}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

      // Update sync state
      await this.callbacks.updateSyncState(this.mailboxId, {
        folderName: folder,
        lastUid: result.lastUid,
        lastSyncAt: new Date(),
      });

    } catch (error) {
      result.errors.push(
        `Sync failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      await this.imapClient.disconnect();
    }

    return result;
  }

  /**
   * Sync all standard folders
   */
  async syncAll(): Promise<Map<string, SyncResult>> {
    const results = new Map<string, SyncResult>();

    try {
      await this.imapClient.connect();
      const folders = await this.imapClient.listFolders();
      await this.imapClient.disconnect();

      // Sync standard folders
      const foldersToSync = folders.filter((f) =>
        ["INBOX", "Sent", "Drafts", "Archive"].some(
          (std) => f.toLowerCase().includes(std.toLowerCase())
        )
      );

      for (const folder of foldersToSync) {
        const result = await this.syncFolder(folder);
        results.set(folder, result);
      }
    } catch (error) {
      results.set("_error", {
        folder: "_error",
        newEmails: 0,
        newThreads: 0,
        updatedThreads: 0,
        errors: [error instanceof Error ? error.message : String(error)],
        lastUid: 0,
      });
    }

    return results;
  }

  private async processEmail(
    fetchedEmail: FetchedEmail,
    folder: string,
    existingThreads: ThreadInfo[],
    result: SyncResult
  ): Promise<void> {
    const emailToStore: EmailToStore = {
      uid: fetchedEmail.uid,
      messageId: fetchedEmail.messageId,
      inReplyTo: fetchedEmail.inReplyTo,
      references: fetchedEmail.references,
      subject: fetchedEmail.subject,
      bodyText: fetchedEmail.bodyText,
      bodyHtml: fetchedEmail.bodyHtml,
      fromAddress: fetchedEmail.from.address,
      fromName: fetchedEmail.from.name,
      toAddresses: fetchedEmail.to.map((t) => t.address),
      ccAddresses: fetchedEmail.cc.map((c) => c.address),
      date: fetchedEmail.date,
      folder,
      isBot: isLikelyBot({
        fromAddress: fetchedEmail.from.address,
        subject: fetchedEmail.subject,
        headers: fetchedEmail.headers,
      }),
      headers: fetchedEmail.headers,
      attachments: fetchedEmail.attachments,
    };

    // Try to match to existing thread
    const match = matchEmailToThread(
      {
        messageId: fetchedEmail.messageId,
        inReplyTo: fetchedEmail.inReplyTo,
        references: fetchedEmail.references,
        subject: fetchedEmail.subject,
        fromAddress: fetchedEmail.from.address,
        toAddresses: fetchedEmail.to.map((t) => t.address),
        date: fetchedEmail.date,
      },
      existingThreads
    );

    if (match.threadId && match.confidence > 0.5) {
      // Add to existing thread
      await this.callbacks.addEmailToThread(match.threadId, emailToStore);
      result.updatedThreads++;

      // Update existing threads list for future matches
      const thread = existingThreads.find((t) => t.id === match.threadId);
      if (thread) {
        thread.messageIds.push(emailToStore.messageId);
      }
    } else {
      // Create new thread
      const threadId = await this.callbacks.createThread(
        this.mailboxId,
        this.teamId,
        {
          subject: normalizeSubject(emailToStore.subject) || emailToStore.subject,
          emails: [emailToStore],
        }
      );
      result.newThreads++;

      // Add to existing threads list for future matches
      existingThreads.push({
        id: threadId,
        messageIds: [emailToStore.messageId],
        subject: emailToStore.subject,
      });
    }

    result.newEmails++;
  }
}
