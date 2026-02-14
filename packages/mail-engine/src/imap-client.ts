import { ImapFlow, FetchMessageObject } from "imapflow";
import { simpleParser, ParsedMail } from "mailparser";

export interface ImapConfig {
  host: string;
  port: number;
  secure?: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

export interface FetchedEmail {
  uid: number;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  from: { address: string; name: string };
  to: Array<{ address: string; name: string }>;
  cc: Array<{ address: string; name: string }>;
  date: Date;
  bodyText: string;
  bodyHtml: string | null;
  headers: Record<string, string>;
  attachments: Array<{
    filename: string;
    contentType: string;
    size: number;
    content: Buffer;
  }>;
}

export class ImapClient {
  private client: ImapFlow;
  private config: ImapConfig;
  private connected: boolean = false;

  constructor(config: ImapConfig) {
    this.config = config;
    this.client = this.createClient();
  }

  private createClient(): ImapFlow {
    return new ImapFlow({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure ?? this.config.port === 993,
      auth: this.config.auth,
      logger: false,
    });
  }

  /**
   * Connect to the IMAP server
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    // Create a fresh client instance since ImapFlow can't be reused after disconnect
    this.client = this.createClient();
    await this.client.connect();
    this.connected = true;
  }

  /**
   * Disconnect from the IMAP server
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;
    await this.client.logout();
    this.connected = false;
  }

  /**
   * List all mailbox folders
   */
  async listFolders(): Promise<string[]> {
    const folders: string[] = [];
    const list = await this.client.list();

    for (const folder of list) {
      folders.push(folder.path);
    }

    return folders;
  }

  /**
   * Get folder status (message count, unseen, etc.)
   */
  async getFolderStatus(folder: string): Promise<{
    messages: number;
    unseen: number;
    uidNext: number;
    uidValidity: number;
  }> {
    const status = await this.client.status(folder, {
      messages: true,
      unseen: true,
      uidNext: true,
      uidValidity: true,
    });

    return {
      messages: Number(status.messages ?? 0),
      unseen: Number(status.unseen ?? 0),
      uidNext: Number(status.uidNext ?? 0),
      uidValidity: Number(status.uidValidity ?? 0),
    };
  }

  /**
   * Fetch emails from a folder
   * @param folder - Folder name (e.g., "INBOX")
   * @param uidRange - UID range (e.g., "1:*" for all, "100:*" for UID >= 100)
   * @param limit - Maximum number of emails to fetch
   */
  async fetchEmails(
    folder: string,
    uidRange: string = "1:*",
    limit?: number
  ): Promise<FetchedEmail[]> {
    const emails: FetchedEmail[] = [];

    const lock = await this.client.getMailboxLock(folder);
    try {
      let count = 0;
      for await (const message of this.client.fetch(uidRange, {
        uid: true,
        envelope: true,
        source: true,
      })) {
        if (limit && count >= limit) break;

        const parsed = await this.parseMessage(message);
        if (parsed) {
          emails.push(parsed);
          count++;
        }
      }
    } finally {
      lock.release();
    }

    return emails;
  }

  /**
   * Fetch emails since a specific UID
   */
  async fetchEmailsSinceUid(
    folder: string,
    sinceUid: number,
    limit?: number
  ): Promise<FetchedEmail[]> {
    return this.fetchEmails(folder, `${sinceUid}:*`, limit);
  }

  /**
   * Fetch a single email by UID
   */
  async fetchEmailByUid(folder: string, uid: number): Promise<FetchedEmail | null> {
    const lock = await this.client.getMailboxLock(folder);
    try {
      // Use fetch with specific UID range instead of fetchOne
      for await (const message of this.client.fetch(`${uid}`, {
        uid: true,
        envelope: true,
        source: true,
      })) {
        return this.parseMessage(message);
      }
      return null;
    } finally {
      lock.release();
    }
  }

  /**
   * Search for emails matching criteria
   */
  async searchEmails(
    folder: string,
    criteria: {
      since?: Date;
      before?: Date;
      from?: string;
      to?: string;
      subject?: string;
      unseen?: boolean;
    }
  ): Promise<number[]> {
    const lock = await this.client.getMailboxLock(folder);
    try {
      const searchCriteria: Record<string, unknown> = {};

      if (criteria.since) searchCriteria.since = criteria.since;
      if (criteria.before) searchCriteria.before = criteria.before;
      if (criteria.from) searchCriteria.from = criteria.from;
      if (criteria.to) searchCriteria.to = criteria.to;
      if (criteria.subject) searchCriteria.subject = criteria.subject;
      if (criteria.unseen) searchCriteria.unseen = true;

      const uids = await this.client.search(searchCriteria, { uid: true });
      return uids as number[];
    } finally {
      lock.release();
    }
  }

  /**
   * Check if currently connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Mark email as seen/read
   */
  async markAsSeen(folder: string, uid: number): Promise<void> {
    const lock = await this.client.getMailboxLock(folder);
    try {
      await this.client.messageFlagsAdd(uid.toString(), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Mark email as unseen/unread
   */
  async markAsUnseen(folder: string, uid: number): Promise<void> {
    const lock = await this.client.getMailboxLock(folder);
    try {
      await this.client.messageFlagsRemove(uid.toString(), ["\\Seen"], { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Add flags to an email
   */
  async addFlags(folder: string, uid: number, flags: string[]): Promise<void> {
    const lock = await this.client.getMailboxLock(folder);
    try {
      await this.client.messageFlagsAdd(uid.toString(), flags, { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Remove flags from an email
   */
  async removeFlags(folder: string, uid: number, flags: string[]): Promise<void> {
    const lock = await this.client.getMailboxLock(folder);
    try {
      await this.client.messageFlagsRemove(uid.toString(), flags, { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Mark email as deleted (sets \Deleted flag)
   * Note: This doesn't permanently delete - use expunge() after
   */
  async markAsDeleted(folder: string, uid: number): Promise<void> {
    const lock = await this.client.getMailboxLock(folder);
    try {
      await this.client.messageFlagsAdd(uid.toString(), ["\\Deleted"], { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Permanently remove emails marked as \Deleted from folder
   */
  async expunge(folder: string): Promise<void> {
    const lock = await this.client.getMailboxLock(folder);
    try {
      await this.client.messageDelete({ all: true }, { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Move email to another folder
   */
  async moveEmail(folder: string, uid: number, destFolder: string): Promise<void> {
    const lock = await this.client.getMailboxLock(folder);
    try {
      await this.client.messageMove(uid.toString(), destFolder, { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Copy email to another folder
   */
  async copyEmail(folder: string, uid: number, destFolder: string): Promise<void> {
    const lock = await this.client.getMailboxLock(folder);
    try {
      await this.client.messageCopy(uid.toString(), destFolder, { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Move email to trash folder (convenience method)
   */
  async moveToTrash(folder: string, uid: number, trashFolder: string = "Trash"): Promise<void> {
    await this.moveEmail(folder, uid, trashFolder);
  }

  /**
   * Move email to archive folder (convenience method)
   */
  async moveToArchive(folder: string, uid: number, archiveFolder: string = "Archive"): Promise<void> {
    await this.moveEmail(folder, uid, archiveFolder);
  }

  /**
   * Batch move multiple emails
   */
  async moveEmails(folder: string, uids: number[], destFolder: string): Promise<void> {
    if (uids.length === 0) return;
    const lock = await this.client.getMailboxLock(folder);
    try {
      const uidRange = uids.join(",");
      await this.client.messageMove(uidRange, destFolder, { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Batch add flags to multiple emails
   */
  async addFlagsBatch(folder: string, uids: number[], flags: string[]): Promise<void> {
    if (uids.length === 0) return;
    const lock = await this.client.getMailboxLock(folder);
    try {
      const uidRange = uids.join(",");
      await this.client.messageFlagsAdd(uidRange, flags, { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Batch remove flags from multiple emails
   */
  async removeFlagsBatch(folder: string, uids: number[], flags: string[]): Promise<void> {
    if (uids.length === 0) return;
    const lock = await this.client.getMailboxLock(folder);
    try {
      const uidRange = uids.join(",");
      await this.client.messageFlagsRemove(uidRange, flags, { uid: true });
    } finally {
      lock.release();
    }
  }

  /**
   * Parse a raw email message
   */
  private async parseMessage(message: FetchMessageObject): Promise<FetchedEmail | null> {
    if (!message.source) return null;

    const parsed = await simpleParser(message.source);

    return {
      uid: message.uid,
      messageId: parsed.messageId || `<generated-${message.uid}@local>`,
      inReplyTo: parsed.inReplyTo || null,
      references: this.parseReferences(parsed.references),
      subject: parsed.subject || "(No Subject)",
      from: this.parseAddress(parsed.from),
      to: this.parseAddressList(parsed.to),
      cc: this.parseAddressList(parsed.cc),
      date: parsed.date || new Date(),
      bodyText: parsed.text || "",
      bodyHtml: parsed.html || null,
      headers: this.parseHeaders(parsed.headers),
      attachments: (parsed.attachments || []).map((att) => ({
        filename: att.filename || "attachment",
        contentType: att.contentType,
        size: att.size,
        content: att.content,
      })),
    };
  }

  private parseAddress(addr: ParsedMail["from"]): { address: string; name: string } {
    if (!addr || !addr.value || addr.value.length === 0) {
      return { address: "", name: "" };
    }
    const first = addr.value[0];
    return {
      address: first.address || "",
      name: first.name || "",
    };
  }

  private parseAddressList(
    addrs: ParsedMail["to"]
  ): Array<{ address: string; name: string }> {
    if (!addrs) return [];

    const values = Array.isArray(addrs) ? addrs : [addrs];
    const result: Array<{ address: string; name: string }> = [];

    for (const addr of values) {
      if (addr.value) {
        for (const v of addr.value) {
          result.push({
            address: v.address || "",
            name: v.name || "",
          });
        }
      }
    }

    return result;
  }

  private parseReferences(refs: string | string[] | undefined): string[] {
    if (!refs) return [];
    if (typeof refs === "string") {
      return refs.split(/\s+/).filter(Boolean);
    }
    return refs;
  }

  private parseHeaders(headers: ParsedMail["headers"]): Record<string, string> {
    const result: Record<string, string> = {};
    if (headers) {
      headers.forEach((value, key) => {
        result[key] = typeof value === "string" ? value : JSON.stringify(value);
      });
    }
    return result;
  }
}
