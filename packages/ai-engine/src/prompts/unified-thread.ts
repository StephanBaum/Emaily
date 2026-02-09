import type { ChatMessage } from "../providers/provider";
import type { EmailIntent } from "@emailautomation/shared";

interface ThreadEmail {
  from: string;
  body: string;
  date: Date;
  isSent: boolean;
}

interface TagInfo {
  name: string;
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

  const tagNames = availableTags.map((t) => t.name).join(", ");

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

Available tags: ${tagNames || "(none)"}${qaBlock}${personalityBlock}${contextBlock}

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
- draft: null if not generating. confidence scores all 0.0-1.0.
- Be concise and accurate.`;

  // Build thread conversation, capping each email at 1500 chars
  const conversationLines = emails.map((e) => {
    const direction = e.isSent ? "[SENT]" : "[RECEIVED]";
    const truncatedBody = e.body.length > 1500 ? e.body.slice(0, 1500) + "..." : e.body;
    return `${direction} From: ${e.from} (${e.date.toISOString()})\n${truncatedBody}`;
  });

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
