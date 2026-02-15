import type { AIProvider } from "../providers/provider";
import type { UnifiedAIResult, EmailIntent, DraftConfidence } from "@emaily/shared";
import { buildUnifiedThreadPrompt } from "../prompts/unified-thread";

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

export interface ThreadContext {
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

export interface UnifiedProcessOptions {
  subject: string;
  emails: ThreadEmail[];
  availableTags: TagInfo[];
  qaPairs: QAPairInfo[];
  agentPersonality?: string;
  generateDraft: boolean;
  replyTo: string;
  temperature?: number;
  threadContext?: ThreadContext;
}

const EMPTY_RESULT: UnifiedAIResult = { tags: [], intents: [], draft: null };

export class UnifiedThreadProcessor {
  constructor(private provider: AIProvider) {}

  async processThread(options: UnifiedProcessOptions): Promise<UnifiedAIResult> {
    const messages = buildUnifiedThreadPrompt({
      subject: options.subject,
      emails: options.emails,
      availableTags: options.availableTags,
      qaPairs: options.qaPairs,
      agentPersonality: options.agentPersonality,
      generateDraft: options.generateDraft,
      replyTo: options.replyTo,
      threadContext: options.threadContext,
    });

    const response = await this.provider.complete({
      messages,
      temperature: options.temperature ?? 0.3,
      responseFormat: "json",
    });

    return this.parseAndValidate(response.content, options.availableTags);
  }

  private parseAndValidate(content: string, availableTags: TagInfo[]): UnifiedAIResult {
    try {
      const parsed = JSON.parse(content);
      const tagNameSet = new Set(availableTags.map((t) => t.name.toLowerCase()));

      const tags = this.validateTags(parsed.tags, tagNameSet);
      const intents = this.validateIntents(parsed.intents);
      const draft = this.validateDraft(parsed.draft);

      return { tags, intents, draft };
    } catch (err) {
      console.error("[UnifiedThreadProcessor] Failed to parse LLM response:", err);
      return EMPTY_RESULT;
    }
  }

  private validateTags(
    raw: unknown,
    validNames: Set<string>
  ): UnifiedAIResult["tags"] {
    if (!Array.isArray(raw)) return [];

    return raw
      .filter((item): item is { name: string; confidence: number } => {
        return (
          typeof item?.name === "string" &&
          typeof item?.confidence === "number" &&
          item.confidence >= 0.5 &&
          validNames.has(item.name.toLowerCase())
        );
      })
      .map((item) => ({
        name: item.name,
        confidence: Math.min(1, Math.max(0, item.confidence)),
      }));
  }

  private validateIntents(raw: unknown): EmailIntent[] {
    if (!Array.isArray(raw)) return [];

    const validTypes = new Set(["question", "request", "info"]);

    return raw
      .filter((item): item is { type: string; text: string; priority: number } => {
        return (
          typeof item?.type === "string" &&
          validTypes.has(item.type) &&
          typeof item?.text === "string" &&
          item.text.length > 0
        );
      })
      .slice(0, 10)
      .map((item) => ({
        type: item.type as EmailIntent["type"],
        text: item.text,
        priority: Math.min(3, Math.max(1, Math.round(item.priority ?? 2))),
      }));
  }

  private validateDraft(
    raw: unknown
  ): UnifiedAIResult["draft"] {
    if (!raw || typeof raw !== "object") return null;

    const draft = raw as Record<string, unknown>;
    if (typeof draft.subject !== "string" || typeof draft.body !== "string") {
      return null;
    }

    if (!draft.body.trim()) return null;

    const confidence = this.normalizeConfidence(
      draft.confidence as Record<string, unknown> | undefined
    );

    return {
      subject: draft.subject,
      body: draft.body,
      confidence,
    };
  }

  private normalizeConfidence(raw: Record<string, unknown> | undefined): DraftConfidence {
    const clamp = (v: unknown): number => {
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
}
