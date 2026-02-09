import type { ChatMessage } from "../providers/provider";

interface TagInfo {
  name: string;
  color: string;
}

interface EmailInfo {
  subject: string;
  from: string;
  to: string[];
  body: string;
}

export function buildAutoTagPrompt(email: EmailInfo, tags: TagInfo[]): ChatMessage[] {
  const tagNames = tags.map((t) => t.name).join(", ");

  return [
    {
      role: "system",
      content: `You are an email classification assistant. Your job is to analyze incoming emails and assign relevant tags from a predefined set.

Rules:
- Only assign tags from the provided list
- Each tag should have a confidence score between 0 and 1
- Only include tags with confidence >= 0.5
- Return a JSON array of objects with "name" and "confidence" fields
- Be conservative: only tag when clearly relevant
- Consider subject, sender, recipients, and body content

Available tags: ${tagNames}

Respond with ONLY valid JSON. Example:
[{"name": "Support", "confidence": 0.9}, {"name": "Billing", "confidence": 0.7}]`,
    },
    {
      role: "user",
      content: `Classify this email:

Subject: ${email.subject}
From: ${email.from}
To: ${email.to.join(", ")}

Body:
${email.body.slice(0, 2000)}`,
    },
  ];
}
