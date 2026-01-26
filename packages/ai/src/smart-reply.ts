/**
 * Smart reply generation using AI.
 *
 * Provides functions for generating intelligent reply suggestions
 * for emails using the Vercel AI SDK with OpenAI.
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  SmartReplySchema,
  type SmartReply,
  type SmartReplyItem,
  type ReplyTone,
} from "./schemas";

/**
 * Default model for smart reply generation.
 */
const DEFAULT_SMART_REPLY_MODEL = "gpt-4o";

/**
 * Input for smart reply generation.
 */
export interface SmartReplyInput {
  /** Email subject line */
  subject: string;
  /** Email body content */
  body: string;
  /** Email sender address */
  sender?: string;
  /** Thread context (previous emails in the thread) */
  threadContext?: string;
}

/**
 * Options for smart reply generation.
 */
export interface SmartReplyOptions {
  /** Override the default model */
  model?: string;
  /** Number of replies to generate (default: 3) */
  replyCount?: number;
  /** Preferred tones for replies */
  preferredTones?: ReplyTone[];
  /** Custom system prompt */
  systemPrompt?: string;
  /** User's name for personalization */
  userName?: string;
}

/**
 * Default system prompt for smart reply generation.
 */
const DEFAULT_SYSTEM_PROMPT = `You are an intelligent email assistant that generates smart reply suggestions.
Generate helpful reply options that the user can choose from or customize.

Guidelines:
- Generate a variety of reply styles (short/quick and longer/detailed)
- Include different tones: formal, casual, friendly, professional
- Make replies contextually appropriate to the email content
- Keep short replies under 50 words
- Ensure replies are complete and can be sent as-is
- Don't include placeholder text like [Your Name] - keep it generic enough to work as-is`;

/**
 * Generate smart reply suggestions for an email.
 *
 * Analyzes the email content and generates multiple reply suggestions
 * with varying tones and lengths.
 *
 * @param email - The email to generate replies for
 * @param options - Optional configuration for reply generation
 * @returns Array of smart reply suggestions
 *
 * @example
 * ```typescript
 * const result = await generateSmartReplies({
 *   subject: "Meeting Tomorrow at 10am",
 *   body: "Hi, can we meet tomorrow to discuss the project?",
 *   sender: "colleague@company.com"
 * });
 *
 * console.log(result.replies[0].content); // "Sure, I'll be there!"
 * console.log(result.replies[0].tone); // "friendly"
 * ```
 */
export async function generateSmartReplies(
  email: SmartReplyInput,
  options: SmartReplyOptions = {}
): Promise<SmartReply> {
  const {
    model = DEFAULT_SMART_REPLY_MODEL,
    replyCount = 3,
    preferredTones,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    userName,
  } = options;

  // Build the email content string for the prompt
  const emailContent = buildEmailContent(email);

  // Build additional context for the prompt
  const additionalContext = buildAdditionalContext({
    replyCount,
    preferredTones,
    userName,
  });

  const result = await generateObject({
    model: openai(model),
    schema: SmartReplySchema,
    system: systemPrompt,
    prompt: `Generate ${replyCount} smart reply suggestions for this email:\n\n${emailContent}\n\n${additionalContext}`,
  });

  return result.object;
}

/**
 * Generate a single smart reply with a specific tone.
 *
 * Useful when you need a reply in a particular tone rather than
 * multiple options.
 *
 * @param email - The email to generate a reply for
 * @param tone - The desired tone for the reply
 * @param options - Optional configuration
 * @returns A single smart reply item
 *
 * @example
 * ```typescript
 * const reply = await generateSmartReplyWithTone(
 *   { subject: "Quick question", body: "When is the deadline?" },
 *   "professional"
 * );
 *
 * console.log(reply.content); // "The deadline is set for..."
 * ```
 */
export async function generateSmartReplyWithTone(
  email: SmartReplyInput,
  tone: ReplyTone,
  options: Omit<SmartReplyOptions, "preferredTones" | "replyCount"> = {}
): Promise<SmartReplyItem> {
  const { model = DEFAULT_SMART_REPLY_MODEL, systemPrompt, userName } = options;

  const emailContent = buildEmailContent(email);
  const customSystem =
    systemPrompt ||
    `You are an intelligent email assistant. Generate a single reply with a ${tone} tone.
The reply should be appropriate for the email content and ready to send as-is.`;

  const userContext = userName ? `\n\nThe user's name is: ${userName}` : "";

  const result = await generateObject({
    model: openai(model),
    schema: SmartReplySchema,
    system: customSystem,
    prompt: `Generate exactly 1 ${tone} reply for this email:\n\n${emailContent}${userContext}`,
  });

  // Return the first reply, or create a default if none generated
  return (
    result.object.replies[0] || {
      tone,
      content: "",
      isShort: true,
    }
  );
}

/**
 * Build email content string for the AI prompt.
 */
function buildEmailContent(email: SmartReplyInput): string {
  const parts: string[] = [];

  if (email.sender) {
    parts.push(`From: ${email.sender}`);
  }

  parts.push(`Subject: ${email.subject}`);
  parts.push(""); // Empty line before body
  parts.push(email.body);

  if (email.threadContext) {
    parts.push("");
    parts.push("--- Previous thread context ---");
    parts.push(email.threadContext);
  }

  return parts.join("\n");
}

/**
 * Build additional context for the prompt.
 */
function buildAdditionalContext(options: {
  replyCount: number;
  preferredTones?: ReplyTone[];
  userName?: string;
}): string {
  const parts: string[] = [];

  parts.push(`Generate exactly ${options.replyCount} reply suggestions.`);

  if (options.preferredTones && options.preferredTones.length > 0) {
    parts.push(`Preferred tones: ${options.preferredTones.join(", ")}`);
  } else {
    parts.push(
      "Include a mix of tones (formal, casual, friendly, professional)."
    );
  }

  parts.push("Include at least one short/quick reply option.");

  if (options.userName) {
    parts.push(`The user's name is: ${options.userName}`);
  }

  return parts.join("\n");
}
