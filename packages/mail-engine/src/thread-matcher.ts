/**
 * Thread Matcher
 *
 * Matches emails to existing threads using:
 * 1. In-Reply-To header - direct reply reference
 * 2. References header - full chain of message IDs
 * 3. Subject matching - "Re:" prefix matching (fallback)
 */

export interface EmailForMatching {
  messageId: string;
  inReplyTo: string | null;
  references: string[];
  subject: string;
  fromAddress: string;
  toAddresses: string[];
  date: Date;
}

export interface ThreadInfo {
  id: string;
  messageIds: string[];
  subject: string;
}

export interface MatchResult {
  threadId: string | null;
  matchType: "in-reply-to" | "references" | "subject" | "none";
  confidence: number;
}

/**
 * Find the thread an email belongs to
 */
export function matchEmailToThread(
  email: EmailForMatching,
  existingThreads: ThreadInfo[]
): MatchResult {
  // 1. Check In-Reply-To header (highest confidence)
  if (email.inReplyTo) {
    const thread = existingThreads.find((t) =>
      t.messageIds.includes(email.inReplyTo!)
    );
    if (thread) {
      return {
        threadId: thread.id,
        matchType: "in-reply-to",
        confidence: 1.0,
      };
    }
  }

  // 2. Check References header (high confidence)
  if (email.references.length > 0) {
    for (const ref of email.references) {
      const thread = existingThreads.find((t) => t.messageIds.includes(ref));
      if (thread) {
        return {
          threadId: thread.id,
          matchType: "references",
          confidence: 0.95,
        };
      }
    }
  }

  // 3. Subject-based matching (lower confidence, fallback)
  const normalizedSubject = normalizeSubject(email.subject);
  if (normalizedSubject) {
    const matchingThread = existingThreads.find((t) => {
      const threadSubject = normalizeSubject(t.subject);
      return threadSubject === normalizedSubject;
    });

    if (matchingThread) {
      return {
        threadId: matchingThread.id,
        matchType: "subject",
        confidence: 0.7,
      };
    }
  }

  // No match found
  return {
    threadId: null,
    matchType: "none",
    confidence: 0,
  };
}

/**
 * Normalize email subject for comparison
 * Removes Re:, Fwd:, etc. prefixes and normalizes whitespace
 */
export function normalizeSubject(subject: string): string {
  if (!subject) return "";

  // Remove common prefixes (case-insensitive)
  let normalized = subject
    .replace(/^(re|fwd|fw|aw|antw|sv|vs|ref):\s*/gi, "")
    .replace(/^\[.*?\]\s*/g, "") // Remove [tag] prefixes
    .trim();

  // Keep removing prefixes until none remain
  let prev = "";
  while (prev !== normalized) {
    prev = normalized;
    normalized = normalized
      .replace(/^(re|fwd|fw|aw|antw|sv|vs|ref):\s*/gi, "")
      .replace(/^\[.*?\]\s*/g, "")
      .trim();
  }

  // Normalize whitespace
  normalized = normalized.replace(/\s+/g, " ");

  return normalized.toLowerCase();
}

/**
 * Build a thread chain from message IDs
 * Returns ordered list of message IDs from oldest to newest
 */
export function buildThreadChain(
  emails: Array<{ messageId: string; inReplyTo: string | null; date: Date }>
): string[] {
  // Create a map of messageId -> email
  const emailMap = new Map(emails.map((e) => [e.messageId, e]));

  // Find root emails (no inReplyTo or inReplyTo not in our set)
  const roots = emails.filter(
    (e) => !e.inReplyTo || !emailMap.has(e.inReplyTo)
  );

  // Build chain starting from roots
  const chain: string[] = [];
  const visited = new Set<string>();

  function visit(messageId: string) {
    if (visited.has(messageId)) return;
    visited.add(messageId);
    chain.push(messageId);

    // Find replies to this message
    const replies = emails
      .filter((e) => e.inReplyTo === messageId)
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    for (const reply of replies) {
      visit(reply.messageId);
    }
  }

  // Start from roots, sorted by date
  roots
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .forEach((root) => visit(root.messageId));

  // Add any orphaned messages
  for (const email of emails) {
    if (!visited.has(email.messageId)) {
      chain.push(email.messageId);
    }
  }

  return chain;
}

/**
 * Extract thread participants from emails
 */
export function extractParticipants(
  emails: Array<{
    fromAddress: string;
    toAddresses: string[];
    ccAddresses?: string[];
  }>
): string[] {
  const participants = new Set<string>();

  for (const email of emails) {
    participants.add(email.fromAddress.toLowerCase());
    for (const to of email.toAddresses) {
      participants.add(to.toLowerCase());
    }
    if (email.ccAddresses) {
      for (const cc of email.ccAddresses) {
        participants.add(cc.toLowerCase());
      }
    }
  }

  return Array.from(participants);
}

/**
 * Determine if an email is likely automated/bot
 */
export function isLikelyBot(email: {
  fromAddress: string;
  subject: string;
  headers?: Record<string, string>;
}): boolean {
  const fromLower = email.fromAddress.toLowerCase();

  // Check common bot patterns
  const botPatterns = [
    /^noreply@/,
    /^no-reply@/,
    /^donotreply@/,
    /^mailer-daemon@/,
    /^postmaster@/,
    /^notifications?@/,
    /^alerts?@/,
    /^system@/,
    /^auto@/,
    /^bounce/,
  ];

  if (botPatterns.some((p) => p.test(fromLower))) {
    return true;
  }

  // Check headers
  if (email.headers) {
    if (email.headers["x-auto-response-suppress"]) return true;
    if (email.headers["auto-submitted"] === "auto-generated") return true;
    if (email.headers["x-mailer"]?.includes("phpmailer")) return true;
    if (email.headers["precedence"] === "bulk") return true;
  }

  return false;
}
