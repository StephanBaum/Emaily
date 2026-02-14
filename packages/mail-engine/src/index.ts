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

// Spam Analyzer
export {
  analyzeSpam,
  computeSpamScore,
  SPAM_THRESHOLD_QUARANTINE,
  SPAM_THRESHOLD_SUSPICIOUS,
} from "./spam-analyzer";

// Mailbox Syncer
export {
  MailboxSyncer,
  type SyncResult,
  type MailboxSyncState,
  type EmailToStore,
  type ThreadToCreate,
  type SyncCallbacks,
} from "./mailbox-syncer";

// IMAP Operations Queue
export {
  queueImapOperation,
  queueBatchImapOperation,
  checkImapQueueHealth,
  closeImapQueue,
  IMAP_QUEUE_NAME,
} from "./imap-operations";
