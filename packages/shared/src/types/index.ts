// User & Team types
export interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "member";
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Team {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

// Mailbox types
export type MailboxType = "personal" | "shared";
export type MailboxPermission = "read" | "write" | "admin";

export interface Mailbox {
  id: string;
  emailAddress: string;
  type: MailboxType;
  teamId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Thread & Email types
export type ThreadStatus = "open" | "archived" | "snoozed" | "quarantined" | "trashed";
export type AssignmentStatus = "open" | "in_progress" | "done";

// IMAP operation types
export type ImapOperationType =
  | "move_to_trash"
  | "move_to_archive"
  | "move_to_inbox"
  | "mark_read"
  | "mark_unread"
  | "add_flag"
  | "remove_flag"
  | "expunge";

export type ImapOperationStatus = "pending" | "processing" | "completed" | "failed";

export interface ImapOperation {
  id: string;
  mailboxId: string;
  threadId?: string;
  emailId?: string;
  operation: ImapOperationType;
  folder: string;
  imapUid?: number;
  payload: Record<string, unknown>;
  status: ImapOperationStatus;
  attempts: number;
  error?: string;
  createdAt: Date;
  processedAt?: Date;
}

export interface Thread {
  id: string;
  mailboxId: string;
  teamId: string;
  subject: string;
  status: ThreadStatus;
  trashedAt?: Date;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Email {
  id: string;
  threadId: string;
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  imapUid: number | null;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  date: Date;
  folder: string;
  isDraft: boolean;
  isSent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Tag types
export type TagAIAction = "none" | "draft" | "research_draft" | "auto_reply" | "archive" | "quarantine" | "notify";
export type TagAppliedBy = "manual" | "auto" | "ai";

export interface Tag {
  id: string;
  teamId: string;
  name: string;
  color: string;
  aiAction: TagAIAction;
  createdAt: Date;
  updatedAt: Date;
}

// Trust & Spam types
export type TrustLevel = "stranger" | "known" | "trusted" | "vip";
export const TRUST_LEVEL_ORDER: Record<TrustLevel, number> = {
  stranger: 0,
  known: 1,
  trusted: 2,
  vip: 3,
};

export interface SpamAnalysisResult {
  spf: "pass" | "fail" | "softfail" | "none" | "unknown";
  dkim: "pass" | "fail" | "softfail" | "none" | "unknown";
  dmarc: "pass" | "fail" | "softfail" | "none" | "unknown";
  xSpamScore: number | null;
  xSpamStatus: string | null;
  googleSpamVerdict: string | null;
  bulkPrecedence: boolean;
  fromReplyToMismatch: boolean;
  headerScore: number;
  signals: string[];
}

// AI types
export interface EmailIntent {
  type: "question" | "request" | "info";
  text: string;
  priority: number;
}

export interface DraftConfidence {
  overall: number;
  intentCoverage: number;
  qaMatchStrength: number;
  ragRelevance: number;
  toneConsistency: number;
}

// Tag auto-rule types
export type TagRuleOperator = "contains" | "equals" | "startsWith" | "endsWith" | "matches";
export type TagRuleField = "subject" | "from" | "to" | "body";
export type TagRuleLogic = "AND" | "OR";

export interface TagRuleCondition {
  field: TagRuleField;
  operator: TagRuleOperator;
  value: string;
}

export interface TagAutoRules {
  logic: TagRuleLogic;
  conditions: TagRuleCondition[];
}

// Agent types
export interface Agent {
  id: string;
  teamId: string;
  name: string;
  role: string;
  systemPrompt: string;
  avatar: string | null;
  temperature: number;
  active: boolean;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface AgentTagWatch {
  id: string;
  agentId: string;
  tagId: string;
}

// Triage types
export interface ThreadTriage {
  priority: "high" | "medium" | "low";
  needsReply: boolean;
  reasoning: string;
}

export interface EscalationResult {
  reason: string;
  suggestedAction: string;
  partialWork?: {
    tags?: { name: string; confidence: number }[];
    draft?: { subject: string; body: string; confidence: DraftConfidence } | null;
  };
}

// Unified AI result (single LLM call output)
export interface UnifiedAIResult {
  tags: { name: string; confidence: number }[];
  intents: EmailIntent[];
  draft: {
    subject: string;
    body: string;
    confidence: DraftConfidence;
  } | null;
}

// AI processing result
export interface AIProcessingResult {
  threadId: string;
  tagsApplied: { tagId: string; name: string; appliedBy: TagAppliedBy; confidence: number }[];
  intentsExtracted: EmailIntent[];
  draftGenerated: boolean;
  draftId?: string;
  agentId?: string;
  agentName?: string;
  actionsExecuted: AIActionExecuted[];
  error?: string;
}

export interface AIActionExecuted {
  action: TagAIAction;
  tagId?: string;
  tagName?: string;
  detail?: string;
}

export interface AIBulkProcessingResult {
  total: number;
  processed: number;
  errors: number;
  results: AIProcessingResult[];
}

// Preferences
export interface UserPreferences {
  theme: "light" | "dark" | "system";
  density: "compact" | "comfortable";
  dateFormat: "relative" | "absolute" | "iso";
  previewLines: number;
  notifications: {
    browser: boolean;
    sound: boolean;
    digestEmail: boolean;
  };
  onboardingCompleted?: boolean;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
  density: "comfortable",
  dateFormat: "relative",
  previewLines: 2,
  notifications: {
    browser: true,
    sound: false,
    digestEmail: false,
  },
};

// Notifications
export type NotificationType = "ai_notify" | "assignment" | "mention" | "invite";

export interface Notification {
  id: string;
  userId: string;
  teamId: string;
  type: NotificationType;
  title: string;
  message: string | null;
  targetType: string | null;
  targetId: string | null;
  read: boolean;
  createdAt: Date;
}

// Team Invites
export interface TeamInvite {
  id: string;
  teamId: string;
  email: string;
  role: string;
  invitedById: string;
  token: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

// Activity types
export type ActivityAction =
  | "login"
  | "logout"
  | "email_read"
  | "email_sent"
  | "assigned"
  | "tagged"
  | "commented"
  | "archived"
  | "trashed"
  | "restored"
  | "deleted_permanently"
  | "status_changed"
  | "draft_created"
  | "draft_sent"
  | "ai_tagged"
  | "ai_draft_generated"
  | "ai_auto_replied"
  | "ai_archived"
  | "ai_quarantined"
  | "ai_notified"
  | "ai_needs_attention"
  | "ai_agent_routed"
  | "ai_correction";

export interface ActivityLog {
  id: string;
  teamId: string;
  userId: string;
  action: ActivityAction;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  ipAddress: string | null;
  createdAt: Date;
}

// AI Summary types (for dashboard)
export type AISummaryAction =
  | "ai_archived"
  | "ai_tagged"
  | "ai_draft_generated"
  | "ai_auto_replied"
  | "ai_quarantined";

export interface AISummaryItem {
  threadId: string;
  subject: string;
  senderName: string | null;
  senderEmail: string;
  tags: { name: string; color: string }[];
  activityId: string;
  createdAt: Date;
}

export interface AISummaryGroup {
  action: AISummaryAction;
  label: string;
  count: number;
  items: AISummaryItem[];
}

export interface AISummaryResponse {
  groups: AISummaryGroup[];
  totalCount: number;
  since: Date;
}

// Type guards & comparators
export {
  isValidThreadStatus,
  isValidTrustLevel,
  isValidTagAIAction,
  isValidMailboxPermission,
  compareTrustLevels,
} from "../guards";
