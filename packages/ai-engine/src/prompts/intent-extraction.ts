import type { ChatMessage } from "../providers/provider";

interface EmailInfo {
  subject: string;
  from: string;
  body: string;
}

export function buildIntentExtractionPrompt(
  email: EmailInfo,
  threadContext?: string
): ChatMessage[] {
  let contextBlock = "";
  if (threadContext) {
    contextBlock = `\n\nPrevious conversation context:\n${threadContext}\n`;
  }

  return [
    {
      role: "system",
      content: `You are an email analysis assistant. Extract discrete intents from emails — questions that need answering, requests that need action, and informational items.

Rules:
- Classify each intent as "question", "request", or "info"
- Assign priority 1 (high), 2 (medium), or 3 (low) based on urgency and importance
- Extract the actual text/meaning, not just keywords
- Limit to 10 intents maximum
- Consider thread context if provided — don't re-extract intents already addressed
- Be specific: "What is the project timeline?" not "Asks about timeline"

Respond with ONLY valid JSON in this format:
{"intents": [{"type": "question", "text": "What is the project timeline?", "priority": 1}]}`,
    },
    {
      role: "user",
      content: `Extract intents from this email:${contextBlock}

Subject: ${email.subject}
From: ${email.from}

Body:
${email.body.slice(0, 3000)}`,
    },
  ];
}
