import type {
  ThreadStatus,
  TrustLevel,
  TagAIAction,
  MailboxPermission,
} from "./types";
import { TRUST_LEVEL_ORDER } from "./types";

const THREAD_STATUSES: readonly string[] = [
  "open",
  "archived",
  "snoozed",
  "quarantined",
  "trashed",
] as const;

const TRUST_LEVELS: readonly string[] = [
  "stranger",
  "known",
  "trusted",
  "vip",
] as const;

const TAG_AI_ACTIONS: readonly string[] = [
  "none",
  "draft",
  "research_draft",
  "auto_reply",
  "archive",
  "quarantine",
  "notify",
] as const;

const MAILBOX_PERMISSIONS: readonly string[] = [
  "read",
  "write",
  "admin",
] as const;

/** Type guard: checks whether a string is a valid ThreadStatus */
export function isValidThreadStatus(s: string): s is ThreadStatus {
  return THREAD_STATUSES.includes(s);
}

/** Type guard: checks whether a string is a valid TrustLevel */
export function isValidTrustLevel(s: string): s is TrustLevel {
  return TRUST_LEVELS.includes(s);
}

/** Type guard: checks whether a string is a valid TagAIAction */
export function isValidTagAIAction(s: string): s is TagAIAction {
  return TAG_AI_ACTIONS.includes(s);
}

/** Type guard: checks whether a string is a valid MailboxPermission */
export function isValidMailboxPermission(s: string): s is MailboxPermission {
  return MAILBOX_PERMISSIONS.includes(s);
}

/**
 * Compare two trust levels using TRUST_LEVEL_ORDER.
 * Returns a negative number if a < b, 0 if equal, positive if a > b.
 */
export function compareTrustLevels(a: TrustLevel, b: TrustLevel): number {
  return TRUST_LEVEL_ORDER[a] - TRUST_LEVEL_ORDER[b];
}
