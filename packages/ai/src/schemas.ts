/**
 * Zod schemas for AI-powered email processing.
 *
 * These schemas define the structure of AI-generated outputs
 * for email categorization, smart replies, and composition assistance.
 */

import { z } from "zod";

/**
 * Email categories for AI classification.
 * - important: Time-sensitive or requiring action
 * - promotional: Marketing, offers, newsletters
 * - social: Social media notifications, friend updates
 * - updates: Receipts, confirmations, account notifications
 * - spam: Unwanted or potentially malicious emails
 */
export const EmailCategoryEnum = z.enum([
  "important",
  "promotional",
  "social",
  "updates",
  "spam",
]);

export type EmailCategoryType = z.infer<typeof EmailCategoryEnum>;

/**
 * Suggested actions for email processing.
 * - reply: Email needs a response
 * - archive: Email can be archived for reference
 * - delete: Email should be deleted
 * - defer: Email should be handled later
 */
export const SuggestedActionEnum = z.enum([
  "reply",
  "archive",
  "delete",
  "defer",
]);

export type SuggestedActionType = z.infer<typeof SuggestedActionEnum>;

/**
 * Schema for email categorization results.
 *
 * Used by the categorizeEmail function to structure AI responses.
 */
export const EmailCategorySchema = z.object({
  /** The determined category for the email */
  category: EmailCategoryEnum,
  /** Priority level from 1 (lowest) to 5 (highest) */
  priority: z.number().min(1).max(5),
  /** A brief summary of the email content */
  summary: z.string(),
  /** The recommended action to take */
  suggestedAction: SuggestedActionEnum,
});

export type EmailCategory = z.infer<typeof EmailCategorySchema>;

/**
 * Tone options for smart reply suggestions.
 */
export const ReplyToneEnum = z.enum([
  "formal",
  "casual",
  "friendly",
  "professional",
]);

export type ReplyTone = z.infer<typeof ReplyToneEnum>;

/**
 * Schema for individual smart reply suggestion.
 */
export const SmartReplyItemSchema = z.object({
  /** The tone of the reply */
  tone: ReplyToneEnum,
  /** The suggested reply content */
  content: z.string(),
  /** Whether this is a short/quick reply */
  isShort: z.boolean(),
});

export type SmartReplyItem = z.infer<typeof SmartReplyItemSchema>;

/**
 * Schema for smart reply suggestions.
 *
 * Used by the generateSmartReplies function to structure AI responses.
 */
export const SmartReplySchema = z.object({
  /** Array of suggested replies */
  replies: z.array(SmartReplyItemSchema),
});

export type SmartReply = z.infer<typeof SmartReplySchema>;

/**
 * Schema for compose assistance results.
 *
 * Used by the composeAssist function to provide AI writing assistance.
 */
export const ComposeAssistSchema = z.object({
  /** The enhanced/suggested content */
  content: z.string(),
  /** Suggestions for improvement */
  suggestions: z.array(z.string()),
  /** The detected tone of the original text */
  detectedTone: ReplyToneEnum.optional(),
});

export type ComposeAssist = z.infer<typeof ComposeAssistSchema>;

/**
 * Schema for thread summarization results.
 *
 * Used by the summarizeThread function to structure AI responses.
 */
export const ThreadSummarySchema = z.object({
  /** A concise summary of the entire thread */
  summary: z.string(),
  /** Key points and decisions from the discussion */
  keyPoints: z.array(z.string()),
  /** Action items mentioned in the thread */
  actionItems: z.array(z.string()),
  /** Overall sentiment of the conversation */
  sentiment: z.enum(["positive", "neutral", "negative", "mixed"]),
});

export type ThreadSummary = z.infer<typeof ThreadSummarySchema>;
