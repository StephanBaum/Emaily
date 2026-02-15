import type { AIProvider } from "../providers/provider";
import type { EmailIntent, DraftConfidence } from "@emaily/shared";
import { buildDraftGenerationPrompt } from "../prompts/draft-generation";

interface EmailData {
  subject: string;
  from: string;
  to: string[];
  body: string;
}

interface QAPairData {
  id: string;
  triggerPatterns: string[];
  idealResponse: string;
}

export interface DraftResult {
  subject: string;
  body: string;
  confidence: DraftConfidence;
}

export class DraftGenerator {
  constructor(private provider: AIProvider) {}

  async generateDraft(
    email: EmailData,
    intents: EmailIntent[],
    qaPairs: QAPairData[],
    threadContext?: string
  ): Promise<DraftResult> {
    const matchedQA = this.matchQAPairs(intents, qaPairs);

    const messages = buildDraftGenerationPrompt(email, intents, matchedQA, threadContext);

    const response = await this.provider.complete({
      messages,
      temperature: 0.4,
      responseFormat: "json",
    });

    try {
      const parsed = JSON.parse(response.content) as {
        subject?: string;
        body?: string;
        confidence?: Partial<DraftConfidence>;
      };

      return {
        subject: parsed.subject || `Re: ${email.subject}`,
        body: parsed.body || "",
        confidence: this.normalizeConfidence(parsed.confidence),
      };
    } catch {
      console.error("Failed to parse draft generation response:", response.content);
      return {
        subject: `Re: ${email.subject}`,
        body: "",
        confidence: this.defaultConfidence(),
      };
    }
  }

  matchQAPairs(intents: EmailIntent[], qaPairs: QAPairData[]): QAPairData[] {
    if (!qaPairs.length || !intents.length) return [];

    const intentTexts = intents.map((i) => i.text.toLowerCase());

    return qaPairs.filter((qa) =>
      qa.triggerPatterns.some((pattern) => {
        const lowerPattern = pattern.toLowerCase();
        return intentTexts.some(
          (text) => text.includes(lowerPattern) || lowerPattern.includes(text)
        );
      })
    );
  }

  private normalizeConfidence(raw?: Partial<DraftConfidence>): DraftConfidence {
    const clamp = (v: unknown) => {
      const n = typeof v === "number" ? v : 0;
      return Math.min(1, Math.max(0, n));
    };

    return {
      overall: clamp(raw?.overall),
      intentCoverage: clamp(raw?.intentCoverage),
      qaMatchStrength: clamp(raw?.qaMatchStrength),
      ragRelevance: clamp(raw?.ragRelevance),
      toneConsistency: clamp(raw?.toneConsistency),
    };
  }

  private defaultConfidence(): DraftConfidence {
    return {
      overall: 0,
      intentCoverage: 0,
      qaMatchStrength: 0,
      ragRelevance: 0,
      toneConsistency: 0,
    };
  }
}
