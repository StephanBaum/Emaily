/**
 * Email categorization using AI.
 *
 * Provides functions for automatically categorizing emails
 * using the Vercel AI SDK with OpenAI.
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { EmailCategorySchema, type EmailCategory } from "./schemas";

/**
 * Default model for email categorization.
 */
const DEFAULT_CATEGORIZATION_MODEL = "gpt-4o";

/**
 * Input for email categorization.
 */
export interface CategorizeEmailInput {
  /** Email subject line */
  subject: string;
  /** Email body content (plain text preferred) */
  body: string;
  /** Email sender address */
  sender?: string;
  /** Recipient addresses */
  recipients?: string[];
}

/**
 * Options for email categorization.
 */
export interface CategorizeEmailOptions {
  /** Override the default model */
  model?: string;
  /** Custom system prompt for categorization */
  systemPrompt?: string;
}

/**
 * Default system prompt for email categorization.
 */
const DEFAULT_SYSTEM_PROMPT = `You are an intelligent email assistant that categorizes emails.
Analyze the email content and provide:
1. A category: important (urgent/action-required), promotional (marketing/offers), social (social media/personal), updates (receipts/notifications), or spam (unwanted/suspicious)
2. A priority from 1 (lowest) to 5 (highest)
3. A brief summary (1-2 sentences max)
4. A suggested action: reply (needs response), archive (keep for reference), delete (not needed), or defer (handle later)

Consider:
- Emails from known contacts or about urgent matters should be marked important
- Marketing emails, newsletters, and promotions go in promotional
- Social media notifications and personal messages go in social
- Receipts, shipping updates, and account notifications go in updates
- Suspicious or unwanted emails go in spam`;

/**
 * Categorize an email using AI.
 *
 * Analyzes email content and returns a structured categorization
 * including category, priority, summary, and suggested action.
 *
 * @param email - The email content to categorize
 * @param options - Optional configuration for categorization
 * @returns The categorization result
 *
 * @example
 * ```typescript
 * const result = await categorizeEmail({
 *   subject: "Meeting Tomorrow at 10am",
 *   body: "Hi, can we meet tomorrow to discuss the project?",
 *   sender: "colleague@company.com"
 * });
 *
 * console.log(result.category); // "important"
 * console.log(result.priority); // 4
 * console.log(result.suggestedAction); // "reply"
 * ```
 */
export async function categorizeEmail(
  email: CategorizeEmailInput,
  options: CategorizeEmailOptions = {}
): Promise<EmailCategory> {
  const { model = DEFAULT_CATEGORIZATION_MODEL, systemPrompt = DEFAULT_SYSTEM_PROMPT } = options;

  // Build the email content string for the prompt
  const emailContent = buildEmailContent(email);

  const result = await generateObject({
    model: openai(model),
    schema: EmailCategorySchema,
    system: systemPrompt,
    prompt: `Analyze this email and categorize it:\n\n${emailContent}`,
  });

  return result.object;
}

/**
 * Categorize an email from raw content string.
 *
 * A simpler version of categorizeEmail that accepts a single string
 * containing the email content. Follows the spec.md pattern exactly.
 *
 * @param emailContent - The raw email content as a string
 * @param options - Optional configuration for categorization
 * @returns The categorization result
 *
 * @example
 * ```typescript
 * const result = await categorizeEmailContent(
 *   "Subject: Sale Today!\n\nGet 50% off all items..."
 * );
 *
 * console.log(result.category); // "promotional"
 * ```
 */
export async function categorizeEmailContent(
  emailContent: string,
  options: CategorizeEmailOptions = {}
): Promise<EmailCategory> {
  const { model = DEFAULT_CATEGORIZATION_MODEL, systemPrompt = DEFAULT_SYSTEM_PROMPT } = options;

  const result = await generateObject({
    model: openai(model),
    schema: EmailCategorySchema,
    system: systemPrompt,
    prompt: `Analyze this email and categorize it:\n\n${emailContent}`,
  });

  return result.object;
}

/**
 * Build email content string for the AI prompt.
 */
function buildEmailContent(email: CategorizeEmailInput): string {
  const parts: string[] = [];

  if (email.sender) {
    parts.push(`From: ${email.sender}`);
  }

  if (email.recipients && email.recipients.length > 0) {
    parts.push(`To: ${email.recipients.join(", ")}`);
  }

  parts.push(`Subject: ${email.subject}`);
  parts.push(""); // Empty line before body
  parts.push(email.body);

  return parts.join("\n");
}
