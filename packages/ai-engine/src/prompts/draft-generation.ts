import type { ChatMessage } from "../providers/provider";
import type { EmailIntent } from "@emaily/shared";

interface EmailInfo {
  subject: string;
  from: string;
  to: string[];
  body: string;
}

interface QAPairInfo {
  triggerPatterns: string[];
  idealResponse: string;
}

export function buildDraftGenerationPrompt(
  email: EmailInfo,
  intents: EmailIntent[],
  qaPairs: QAPairInfo[],
  threadContext?: string
): ChatMessage[] {
  const intentsBlock = intents
    .map((i) => `- [${i.type}] (priority ${i.priority}) ${i.text}`)
    .join("\n");

  const qaBlock = qaPairs.length > 0
    ? "\n\nRelevant Q&A reference material:\n" +
      qaPairs.map((qa) => `Q: ${qa.triggerPatterns[0]}\nA: ${qa.idealResponse}`).join("\n\n")
    : "";

  const contextBlock = threadContext
    ? `\n\nPrevious conversation:\n${threadContext}\n`
    : "";

  return [
    {
      role: "system",
      content: `You are a professional email drafting assistant. Generate a reply that addresses all extracted intents from the incoming email.

Rules:
- Address each intent systematically
- Use Q&A reference material when available for accurate responses
- Maintain a professional, helpful tone
- Keep the response concise but thorough
- Do not include the subject line in the body
- Score your confidence in the response

Respond with ONLY valid JSON:
{
  "subject": "Re: ...",
  "body": "email body text",
  "confidence": {
    "overall": 0.0-1.0,
    "intentCoverage": 0.0-1.0,
    "qaMatchStrength": 0.0-1.0,
    "ragRelevance": 0.0-1.0,
    "toneConsistency": 0.0-1.0
  }
}

Confidence scoring:
- overall: Your general confidence in the draft quality
- intentCoverage: How well the draft addresses all intents (1.0 = all addressed)
- qaMatchStrength: How well Q&A pairs matched the intents (0 if none available)
- ragRelevance: How relevant the reference material was (0 if none)
- toneConsistency: How consistent the tone is with the conversation`,
    },
    {
      role: "user",
      content: `Draft a reply to this email:

Subject: ${email.subject}
From: ${email.from}
To: ${email.to.join(", ")}

Body:
${email.body.slice(0, 3000)}
${contextBlock}
Extracted intents to address:
${intentsBlock}
${qaBlock}`,
    },
  ];
}
