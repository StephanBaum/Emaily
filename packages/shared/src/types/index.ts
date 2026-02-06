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
export type ThreadStatus = "open" | "archived" | "snoozed";
export type AssignmentStatus = "open" | "in_progress" | "done";

export interface Thread {
  id: string;
  mailboxId: string;
  teamId: string;
  subject: string;
  status: ThreadStatus;
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
export type TagAIAction = "none" | "draft" | "research_draft" | "auto_reply" | "archive" | "notify";
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
  | "draft_created"
  | "draft_sent";

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
