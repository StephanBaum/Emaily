/**
 * AI package for email intelligence features.
 *
 * This package provides AI-powered utilities for email processing,
 * including categorization, priority detection, and smart replies.
 * Built on the Vercel AI SDK with OpenAI provider.
 */

import { openai } from "@ai-sdk/openai";
import { generateObject, generateText } from "ai";
import { z } from "zod";

/**
 * Default OpenAI model for AI operations.
 * Uses gpt-4o for best quality categorization and responses.
 */
export const DEFAULT_MODEL = "gpt-4o";

/**
 * Create a configured OpenAI model instance.
 * @param modelId - OpenAI model identifier (defaults to gpt-4o)
 */
export function createModel(modelId: string = DEFAULT_MODEL) {
  return openai(modelId);
}

/**
 * Schema for email categorization results.
 */
export const EmailCategorySchema = z.object({
  category: z.enum(["important", "promotional", "social", "updates", "spam"]),
  priority: z.number().min(1).max(5),
  summary: z.string(),
  suggestedAction: z.enum(["reply", "archive", "delete", "defer"]),
});

export type EmailCategory = z.infer<typeof EmailCategorySchema>;

/**
 * Schema for smart reply suggestions.
 */
export const SmartReplySchema = z.object({
  replies: z.array(
    z.object({
      tone: z.enum(["formal", "casual", "friendly", "professional"]),
      content: z.string(),
      isShort: z.boolean(),
    })
  ),
});

export type SmartReply = z.infer<typeof SmartReplySchema>;

// Re-export core AI SDK utilities for convenience
export { generateObject, generateText } from "ai";
export { openai } from "@ai-sdk/openai";
export { z } from "zod";
