import type { ChatMessage } from "../providers/provider";

interface ThreadEmail {
  from: string;
  body: string;
  date: Date;
  isSent: boolean;
}

export interface TagInfo {
  name: string;
  description?: string;
  aiAction?: string;
}

interface QAPairInfo {
  triggerPatterns: string[];
  idealResponse: string;
}

interface ThreadContext {
  existingTags: string[];
  teamComments: { author: string; text: string; date: string }[];
  previousDraft: string | null;
  previousActivity: string[];
  senderTrust?: string;
  senderProfile?: {
    name: string | null;
    company: string | null;
    domain: string | null;
    interactionCount: number;
    repliedToCount: number;
    notes: string | null;
  };
  assignments?: { assignedTo: string; status: string; note: string | null; dueDate: string | null }[];
  attachments?: { filename: string; size: number; contentType: string }[];
  threadAge?: string;
}

interface UnifiedPromptOptions {
  subject: string;
  emails: ThreadEmail[];
  availableTags: TagInfo[];
  qaPairs: QAPairInfo[];
  agentPersonality?: string;
  generateDraft: boolean;
  replyTo: string;
  threadContext?: ThreadContext;
}

export function buildUnifiedThreadPrompt(options: UnifiedPromptOptions): ChatMessage[] {
  const {
    subject,
    emails,
    availableTags,
    qaPairs,
    agentPersonality,
    generateDraft,
    replyTo,
    threadContext,
  } = options;

  const tagBlock = availableTags.length > 0
    ? availableTags.map((t) => {
        const parts = [`- ${t.name}`];
        if (t.description) parts[0] += `: ${t.description}`;
        if (t.aiAction && t.aiAction !== "none") parts[0] += ` (action: ${t.aiAction})`;
        return parts[0];
      }).join("\n")
    : "(none)";

  const qaBlock = qaPairs.length > 0
    ? "\n\nQ&A Knowledge Base:\n" +
      qaPairs.map((qa) => `Q: ${qa.triggerPatterns[0]}\nA: ${qa.idealResponse}`).join("\n\n")
    : "";

  const personalityBlock = agentPersonality
    ? `\n\nAgent personality for drafting:\n${agentPersonality}`
    : "";

  // Build context block so the AI knows what has already been done
  let contextBlock = "";
  if (threadContext) {
    const parts: string[] = [];
    if (threadContext.existingTags.length > 0) {
      parts.push(`Already applied tags: ${threadContext.existingTags.join(", ")}`);
    }
    if (threadContext.previousActivity.length > 0) {
      parts.push(`Previous AI actions on this thread:\n${threadContext.previousActivity.join("\n")}`);
    }
    if (threadContext.teamComments.length > 0) {
      parts.push(
        `Team comments on this thread:\n${threadContext.teamComments
          .map((c) => `- ${c.author}: ${c.text}`)
          .join("\n")}`
      );
    }
    if (threadContext.previousDraft) {
      parts.push(`Previous draft reply:\n${threadContext.previousDraft}`);
    }
    if (threadContext.senderTrust) {
      parts.push(threadContext.senderTrust);
    }
    if (threadContext.senderProfile) {
      const p = threadContext.senderProfile;
      const profileLines = [`Sender profile:`];
      if (p.name) profileLines.push(`  Name: ${p.name}`);
      if (p.company) profileLines.push(`  Company: ${p.company}`);
      if (p.domain) profileLines.push(`  Domain: ${p.domain}`);
      profileLines.push(`  Interactions: ${p.interactionCount}, Replied to: ${p.repliedToCount}`);
      if (p.notes) profileLines.push(`  Notes: ${p.notes}`);
      parts.push(profileLines.join("\n"));
    }
    if (threadContext.assignments && threadContext.assignments.length > 0) {
      parts.push(
        `Thread assignments:\n${threadContext.assignments
          .map((a) => `- Assigned to ${a.assignedTo} (${a.status})${a.dueDate ? ` due ${a.dueDate}` : ""}${a.note ? ` — ${a.note}` : ""}`)
          .join("\n")}`
      );
    }
    if (threadContext.attachments && threadContext.attachments.length > 0) {
      parts.push(
        `Attachments:\n${threadContext.attachments
          .map((a) => `- ${a.filename} (${a.contentType}, ${Math.round(a.size / 1024)}KB)`)
          .join("\n")}`
      );
    }
    if (threadContext.threadAge) {
      parts.push(`Thread age: ${threadContext.threadAge}`);
    }
    if (parts.length > 0) {
      contextBlock = "\n\n--- Existing Context ---\n" + parts.join("\n\n");
    }
  }

  const draftInstruction = generateDraft
    ? `3. DRAFT: Generate a reply to the latest incoming email addressed to ${replyTo}. Address all extracted intents. Consider team comments and previous context when formulating the response. Use Q&A material when relevant. If there is a previous draft, improve upon it rather than starting from scratch. Score your confidence.
   If you generate a draft, set "draft" to an object. If you cannot generate a useful draft, set "draft" to null.`
    : `3. DRAFT: Set "draft" to null (draft generation not requested).`;

  const systemMessage = `You are an email analysis and drafting assistant. Perform ALL of the following tasks in a SINGLE response:

1. TAG CLASSIFICATION: Classify the thread into relevant tags from the available set. Only assign tags that genuinely apply with confidence >= 0.5. Be selective — do not tag everything.
2. INTENT EXTRACTION: Extract discrete intents from the latest incoming email — questions, requests, and informational items. Max 10 intents. Assign priority 1 (high), 2 (medium), or 3 (low).
${draftInstruction}

Available tags:
${tagBlock}${qaBlock}${personalityBlock}${contextBlock}

Respond with ONLY valid JSON in this exact format:
{
  "tags": [{"name": "TagName", "confidence": 0.9}],
  "intents": [{"type": "question", "text": "What is the timeline?", "priority": 1}],
  "draft": {
    "subject": "Re: ...",
    "body": "email body text",
    "confidence": {
      "overall": 0.8,
      "intentCoverage": 0.9,
      "qaMatchStrength": 0.7,
      "ragRelevance": 0.0,
      "toneConsistency": 0.9
    }
  }
}

Rules:
- tags: Only use tags from the available list. confidence 0.0-1.0. Be selective — only apply tags that truly fit.
- intents: type must be "question", "request", or "info". priority 1-3.
- draft: null if not generating. confidence scores all 0.0-1.0. PLAIN TEXT ONLY — no markdown, no bold, no bullet points, no headers.
- NEVER use placeholder brackets like [name], [company], [detail]. Use actual information from context or omit gracefully.
- Write complete, ready-to-send emails that require no editing.
- Be concise and accurate.`;

  // Build thread conversation: full body for latest 3, summarized for older
  const FULL_BODY_COUNT = 3;
  const MAX_TOTAL_CHARS = 8000;
  const conversationLines: string[] = [];
  let totalChars = 0;

  // Process emails from newest to oldest for budget allocation
  const reversedEmails = [...emails].reverse();
  const emailBodies: { index: number; direction: string; from: string; date: string; body: string }[] = [];

  for (let i = 0; i < reversedEmails.length; i++) {
    const e = reversedEmails[i];
    const direction = e.isSent ? "[SENT]" : "[RECEIVED]";
    const dateStr = e.date.toISOString();
    let body: string;

    if (i < FULL_BODY_COUNT) {
      // Full body for latest 3 emails
      body = e.body;
    } else {
      // Truncate older emails to save tokens
      body = e.body.length > 300 ? e.body.slice(0, 300) + "... [older email truncated]" : e.body;
    }

    // Enforce total budget
    if (totalChars + body.length > MAX_TOTAL_CHARS && i >= FULL_BODY_COUNT) {
      body = e.body.slice(0, 150) + "... [truncated for token budget]";
    }
    totalChars += body.length;

    emailBodies.push({ index: reversedEmails.length - 1 - i, direction, from: e.from, date: dateStr, body });
  }

  // Restore chronological order
  emailBodies.sort((a, b) => a.index - b.index);
  for (const e of emailBodies) {
    conversationLines.push(`${e.direction} From: ${e.from} (${e.date})\n${e.body}`);
  }

  const userMessage = `Analyze this email thread:

Subject: ${subject}

--- Thread ---
${conversationLines.join("\n\n---\n\n")}
--- End Thread ---`;

  return [
    { role: "system", content: systemMessage },
    { role: "user", content: userMessage },
  ];
}
