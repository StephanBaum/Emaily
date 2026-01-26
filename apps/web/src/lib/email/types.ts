/**
 * Email provider type definitions
 * Shared types used by Gmail, Outlook, and other email providers
 */

/**
 * Supported email providers
 */
export type EmailProvider = "google" | "microsoft" | "imap";

/**
 * Normalized email message structure
 * Provider-agnostic representation of an email
 */
export interface NormalizedEmail {
  /** Provider-specific message ID */
  id: string;
  /** Thread/conversation ID */
  threadId: string | null;
  /** Email subject line */
  subject: string;
  /** Sender email address and optional name */
  from: EmailAddress;
  /** List of recipients */
  to: EmailAddress[];
  /** CC recipients */
  cc: EmailAddress[];
  /** BCC recipients (usually only visible for sent mail) */
  bcc: EmailAddress[];
  /** Plain text body content */
  bodyText: string;
  /** HTML body content */
  bodyHtml: string | null;
  /** Short preview/snippet of the email */
  snippet: string;
  /** Whether the email has been read */
  isRead: boolean;
  /** Whether the email is starred/flagged */
  isStarred: boolean;
  /** Whether the email has attachments */
  hasAttachments: boolean;
  /** List of labels/folders */
  labels: string[];
  /** When the email was received */
  receivedAt: Date;
  /** Attachments metadata */
  attachments: EmailAttachment[];
}

/**
 * Email address with optional display name
 */
export interface EmailAddress {
  /** Email address */
  email: string;
  /** Display name (if available) */
  name: string | null;
}

/**
 * Email attachment metadata
 */
export interface EmailAttachment {
  /** Attachment ID for downloading */
  id: string;
  /** Filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Size in bytes */
  size: number;
}

/**
 * Options for fetching email list
 */
export interface FetchEmailsOptions {
  /** Maximum number of emails to fetch */
  maxResults?: number;
  /** Page token for pagination */
  pageToken?: string;
  /** Filter by label/folder (e.g., 'INBOX', 'SENT', 'TRASH') */
  labelId?: string;
  /** Search query (provider-specific syntax) */
  query?: string;
  /** Include spam and trash */
  includeSpamTrash?: boolean;
}

/**
 * Result from fetching email list
 */
export interface FetchEmailsResult {
  /** List of normalized emails */
  emails: NormalizedEmail[];
  /** Token for fetching next page (null if no more results) */
  nextPageToken: string | null;
  /** Estimated total number of results */
  resultSizeEstimate?: number;
}

/**
 * Options for sending an email
 */
export interface SendEmailOptions {
  /** Recipient email addresses */
  to: string[];
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Email subject */
  subject: string;
  /** Plain text body */
  bodyText?: string;
  /** HTML body */
  bodyHtml?: string;
  /** Thread ID for replies */
  threadId?: string;
  /** Message ID being replied to (for In-Reply-To header) */
  inReplyTo?: string;
  /** Attachments to include */
  attachments?: SendAttachment[];
}

/**
 * Attachment for sending
 */
export interface SendAttachment {
  /** Filename */
  filename: string;
  /** MIME type */
  mimeType: string;
  /** Base64-encoded content */
  content: string;
}

/**
 * Result from sending an email
 */
export interface SendEmailResult {
  /** Message ID of the sent email */
  messageId: string;
  /** Thread ID */
  threadId: string;
  /** Labels applied to the message */
  labels: string[];
}

/**
 * Email action types for inbox management
 */
export type EmailAction =
  | "archive"
  | "trash"
  | "delete"
  | "markRead"
  | "markUnread"
  | "star"
  | "unstar"
  | "spam"
  | "unspam";

/**
 * Options for modifying email labels
 */
export interface ModifyLabelsOptions {
  /** Labels to add */
  addLabelIds?: string[];
  /** Labels to remove */
  removeLabelIds?: string[];
}

/**
 * OAuth tokens for email API access
 */
export interface EmailOAuthTokens {
  /** Access token for API requests */
  accessToken: string;
  /** Refresh token for obtaining new access tokens */
  refreshToken?: string | null;
  /** Token expiration timestamp */
  expiresAt?: number | null;
}

/**
 * IMAP/SMTP server configuration
 * Used when connecting a custom IMAP email provider
 */
export interface ImapConfig {
  /** User's email address */
  email: string;
  /** Email account password */
  password: string;
  /** IMAP server hostname */
  imapHost: string;
  /** IMAP server port (993 for TLS, 143 for STARTTLS) */
  imapPort: number;
  /** Whether to use TLS (true for port 993) */
  imapSecure: boolean;
  /** SMTP server hostname */
  smtpHost: string;
  /** SMTP server port (587 for STARTTLS, 465 for TLS) */
  smtpPort: number;
  /** Whether to use TLS (true for port 465) */
  smtpSecure: boolean;
}

/**
 * Stored IMAP credentials with encrypted password
 * Represents IMAP account data as stored in the database
 */
export interface StoredImapCredentials {
  /** User's email address */
  email: string;
  /** AES-256 encrypted password */
  encryptedPassword: string;
  /** IMAP server hostname */
  imapHost: string;
  /** IMAP server port (993 for TLS, 143 for STARTTLS) */
  imapPort: number;
  /** Whether to use TLS (true for port 993) */
  imapSecure: boolean;
  /** SMTP server hostname */
  smtpHost: string;
  /** SMTP server port (587 for STARTTLS, 465 for TLS) */
  smtpPort: number;
  /** Whether to use TLS (true for port 465) */
  smtpSecure: boolean;
}

/**
 * Email provider error types
 */
export type EmailErrorType =
  | "authentication"
  | "authorization"
  | "rate_limit"
  | "not_found"
  | "invalid_request"
  | "server_error"
  | "network_error"
  | "unknown";

/**
 * Custom error class for email provider operations
 */
export class EmailProviderError extends Error {
  constructor(
    message: string,
    public readonly type: EmailErrorType,
    public readonly provider: EmailProvider,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = "EmailProviderError";
  }

  /**
   * Check if the error is retryable
   */
  get isRetryable(): boolean {
    return this.type === "rate_limit" || this.type === "server_error" || this.type === "network_error";
  }

  /**
   * Check if re-authentication is required
   */
  get requiresReauth(): boolean {
    return this.type === "authentication" || this.type === "authorization";
  }
}

/**
 * Gmail-specific label IDs
 */
export const GMAIL_LABELS = {
  INBOX: "INBOX",
  SENT: "SENT",
  DRAFTS: "DRAFT",
  SPAM: "SPAM",
  TRASH: "TRASH",
  STARRED: "STARRED",
  UNREAD: "UNREAD",
  IMPORTANT: "IMPORTANT",
  CATEGORY_PERSONAL: "CATEGORY_PERSONAL",
  CATEGORY_SOCIAL: "CATEGORY_SOCIAL",
  CATEGORY_PROMOTIONS: "CATEGORY_PROMOTIONS",
  CATEGORY_UPDATES: "CATEGORY_UPDATES",
  CATEGORY_FORUMS: "CATEGORY_FORUMS",
} as const;

/**
 * Microsoft-specific folder IDs
 */
export const OUTLOOK_FOLDERS = {
  INBOX: "inbox",
  SENT: "sentitems",
  DRAFTS: "drafts",
  DELETED: "deleteditems",
  JUNK: "junkemail",
  ARCHIVE: "archive",
} as const;
