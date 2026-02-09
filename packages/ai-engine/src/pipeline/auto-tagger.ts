import type { AIProvider } from "../providers/provider";
import type { TagAutoRules, TagRuleCondition } from "@emailautomation/shared";
import { buildAutoTagPrompt } from "../prompts/auto-tag";

interface EmailData {
  subject: string;
  from: string;
  to: string[];
  body: string;
}

interface TagData {
  id: string;
  name: string;
  color: string;
  autoRules: TagAutoRules | null;
}

export interface TagMatch {
  tagId: string;
  name: string;
  confidence: number;
  appliedBy: "auto" | "ai";
}

export class AutoTagger {
  constructor(private provider: AIProvider) {}

  async tagEmail(email: EmailData, tags: TagData[]): Promise<TagMatch[]> {
    // Layer 1: Deterministic rules
    const ruleMatches = this.evaluateRules(email, tags);
    const matchedTagIds = new Set(ruleMatches.map((m) => m.tagId));

    // Layer 2: LLM classification for unmatched tags
    const unmatchedTags = tags.filter((t) => !matchedTagIds.has(t.id));
    const llmMatches = unmatchedTags.length > 0
      ? await this.classifyWithLLM(email, unmatchedTags)
      : [];

    return [...ruleMatches, ...llmMatches];
  }

  evaluateRules(email: EmailData, tags: TagData[]): TagMatch[] {
    const matches: TagMatch[] = [];

    for (const tag of tags) {
      if (!tag.autoRules?.conditions?.length) continue;

      const { logic, conditions } = tag.autoRules;
      const results = conditions.map((c) => this.evaluateCondition(c, email));

      const matched = logic === "AND"
        ? results.every(Boolean)
        : results.some(Boolean);

      if (matched) {
        matches.push({
          tagId: tag.id,
          name: tag.name,
          confidence: 1.0,
          appliedBy: "auto",
        });
      }
    }

    return matches;
  }

  async classifyWithLLM(email: EmailData, tags: TagData[]): Promise<TagMatch[]> {
    const messages = buildAutoTagPrompt(email, tags);

    const response = await this.provider.complete({
      messages,
      temperature: 0.2,
      responseFormat: "json",
    });

    const tagByName = new Map(tags.map((t) => [t.name.toLowerCase(), t]));

    try {
      const parsed = JSON.parse(response.content) as { name: string; confidence: number }[];
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((item) => {
          const tag = tagByName.get(item.name?.toLowerCase());
          return tag && typeof item.confidence === "number" && item.confidence >= 0.5;
        })
        .map((item) => {
          const tag = tagByName.get(item.name.toLowerCase())!;
          return {
            tagId: tag.id,
            name: tag.name,
            confidence: Math.min(1, Math.max(0, item.confidence)),
            appliedBy: "ai" as const,
          };
        });
    } catch {
      console.error("Failed to parse LLM tag classification response:", response.content);
      return [];
    }
  }

  private evaluateCondition(condition: TagRuleCondition, email: EmailData): boolean {
    const fieldValue = this.getFieldValue(condition.field, email).toLowerCase();
    const testValue = condition.value.toLowerCase();

    switch (condition.operator) {
      case "contains":
        return fieldValue.includes(testValue);
      case "equals":
        return fieldValue === testValue;
      case "startsWith":
        return fieldValue.startsWith(testValue);
      case "endsWith":
        return fieldValue.endsWith(testValue);
      case "matches":
        try {
          return new RegExp(condition.value, "i").test(fieldValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }

  private getFieldValue(field: string, email: EmailData): string {
    switch (field) {
      case "subject":
        return email.subject;
      case "from":
        return email.from;
      case "to":
        return email.to.join(", ");
      case "body":
        return email.body;
      default:
        return "";
    }
  }
}
