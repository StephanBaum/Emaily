import type { AIProvider } from "../providers/provider";
import type { EmailIntent } from "@emailautomation/shared";
import { buildIntentExtractionPrompt } from "../prompts/intent-extraction";

interface EmailData {
  subject: string;
  from: string;
  body: string;
}

interface PreviousEmail {
  from: string;
  body: string;
  date: Date;
}

export class IntentExtractor {
  constructor(private provider: AIProvider) {}

  async extractIntents(email: EmailData, previousEmails?: PreviousEmail[]): Promise<EmailIntent[]> {
    const threadContext = previousEmails?.length
      ? this.buildThreadContext(previousEmails)
      : undefined;

    const messages = buildIntentExtractionPrompt(email, threadContext);

    const response = await this.provider.complete({
      messages,
      temperature: 0.2,
      responseFormat: "json",
    });

    try {
      const parsed = JSON.parse(response.content) as { intents: unknown[] };
      return this.validateIntents(parsed.intents ?? parsed);
    } catch {
      console.error("Failed to parse intent extraction response:", response.content);
      return [];
    }
  }

  buildThreadContext(previousEmails: PreviousEmail[]): string {
    const summaries = previousEmails
      .slice(-5) // Last 5 emails for context
      .map((e) => {
        const bodyPreview = e.body.slice(0, 200).replace(/\n/g, " ");
        return `[${e.from}]: ${bodyPreview}`;
      });

    const combined = summaries.join("\n");
    // Truncate to ~1000 chars
    return combined.length > 1000 ? combined.slice(0, 1000) + "..." : combined;
  }

  validateIntents(raw: unknown): EmailIntent[] {
    if (!Array.isArray(raw)) return [];

    const validTypes = new Set(["question", "request", "info"]);

    return raw
      .filter((item): item is Record<string, unknown> => {
        if (typeof item !== "object" || item === null) return false;
        const r = item as Record<string, unknown>;
        return (
          typeof r.type === "string" &&
          validTypes.has(r.type) &&
          typeof r.text === "string" &&
          r.text.length > 0 &&
          typeof r.priority === "number" &&
          r.priority >= 1 &&
          r.priority <= 3
        );
      })
      .slice(0, 10)
      .map((item) => ({
        type: item.type as EmailIntent["type"],
        text: String(item.text).slice(0, 500),
        priority: Math.round(item.priority as number),
      }));
  }
}
