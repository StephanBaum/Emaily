/**
 * AI package for email intelligence features.
 *
 * This package provides AI-powered utilities for email processing,
 * including categorization, priority detection, and smart replies.
 * Built on the Vercel AI SDK with OpenAI provider.
 */

import { openai } from "@ai-sdk/openai";

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

// Re-export all schemas and types
export {
  // Enums
  EmailCategoryEnum,
  SuggestedActionEnum,
  ReplyToneEnum,
  // Schemas
  EmailCategorySchema,
  SmartReplySchema,
  SmartReplyItemSchema,
  ComposeAssistSchema,
  // Types
  type EmailCategoryType,
  type SuggestedActionType,
  type EmailCategory,
  type ReplyTone,
  type SmartReplyItem,
  type SmartReply,
  type ComposeAssist,
} from "./schemas";

// Re-export categorization functions
export {
  categorizeEmail,
  categorizeEmailContent,
  type CategorizeEmailInput,
  type CategorizeEmailOptions,
} from "./categorize";

// Re-export smart reply functions
export {
  generateSmartReplies,
  generateSmartReplyWithTone,
  type SmartReplyInput,
  type SmartReplyOptions,
} from "./smart-reply";

// Re-export compose assistance functions
export {
  enhanceDraft,
  draftEmail,
  adjustTone,
  generateSubjectLine,
  type ComposeAssistInput,
  type ComposeAssistOptions,
  type DraftEmailInput,
  type DraftEmailOptions,
  type AdjustToneInput,
} from "./compose-assist";

// Re-export core AI SDK utilities for convenience
export { generateObject, generateText } from "ai";
export { openai } from "@ai-sdk/openai";
export { z } from "zod";
