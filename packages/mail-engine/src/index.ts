// IMAP Client
export {
  ImapClient,
  type ImapConfig,
  type FetchedEmail,
} from "./imap-client";

// SMTP Client
export {
  SmtpClient,
  type SmtpConfig,
  type EmailMessage,
  type SentEmail,
} from "./smtp-client";

// Thread Matching
export {
  matchEmailToThread,
  normalizeSubject,
  buildThreadChain,
  extractParticipants,
  isLikelyBot,
  type EmailForMatching,
  type ThreadInfo,
  type MatchResult,
} from "./thread-matcher";

// Mailbox Syncer
export {
  MailboxSyncer,
  type SyncResult,
  type MailboxSyncState,
  type EmailToStore,
  type ThreadToCreate,
  type SyncCallbacks,
} from "./mailbox-syncer";
