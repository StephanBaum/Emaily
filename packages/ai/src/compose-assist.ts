/**
 * Email composition assistance using AI.
 *
 * Provides functions for AI-assisted email composition,
 * including drafting, tone adjustment, and content enhancement.
 */

import { generateObject, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import {
  ComposeAssistSchema,
  type ComposeAssist,
  type ReplyTone,
} from "./schemas";

/**
 * Default model for compose assistance.
 */
const DEFAULT_COMPOSE_MODEL = "gpt-4o";

/**
 * Input for compose assistance.
 */
export interface ComposeAssistInput {
  /** The draft content to enhance */
  draft: string;
  /** Optional subject line for context */
  subject?: string;
  /** Optional recipient information for context */
  recipient?: string;
  /** Optional context about what the email should achieve */
  intent?: string;
}

/**
 * Options for compose assistance.
 */
export interface ComposeAssistOptions {
  /** Override the default model */
  model?: string;
  /** Target tone for the email */
  targetTone?: ReplyTone;
  /** Whether to fix grammar and spelling */
  fixGrammar?: boolean;
  /** Maximum length for the enhanced content (in words) */
  maxLength?: number;
  /** Custom system prompt */
  systemPrompt?: string;
}

/**
 * Input for drafting a new email.
 */
export interface DraftEmailInput {
  /** What the email should be about */
  intent: string;
  /** Optional subject line */
  subject?: string;
  /** Recipient information */
  recipient?: string;
  /** Key points to include */
  keyPoints?: string[];
  /** Desired tone */
  tone?: ReplyTone;
}

/**
 * Options for drafting.
 */
export interface DraftEmailOptions {
  /** Override the default model */
  model?: string;
  /** Maximum length for the draft (in words) */
  maxLength?: number;
  /** Custom system prompt */
  systemPrompt?: string;
}

/**
 * Input for tone adjustment.
 */
export interface AdjustToneInput {
  /** The content to adjust */
  content: string;
  /** The target tone */
  targetTone: ReplyTone;
  /** Optional context about the email */
  context?: string;
}

/**
 * Default system prompt for compose assistance.
 */
const DEFAULT_COMPOSE_SYSTEM_PROMPT = `You are an intelligent email writing assistant.
Help the user improve their email draft by:
1. Enhancing clarity and readability
2. Fixing grammar and spelling errors
3. Adjusting tone if requested
4. Providing suggestions for improvement

Keep the user's original intent and key information intact.
Don't add placeholder text - provide content that can be sent as-is.`;

/**
 * Enhance an email draft with AI assistance.
 *
 * Analyzes the draft and provides an enhanced version along with
 * improvement suggestions.
 *
 * @param input - The draft content and context
 * @param options - Optional configuration
 * @returns Enhanced content and suggestions
 *
 * @example
 * ```typescript
 * const result = await enhanceDraft({
 *   draft: "hey can u send me the report asap",
 *   intent: "Request a report from a colleague"
 * });
 *
 * console.log(result.content);
 * // "Hi, could you please send me the report at your earliest convenience?"
 * console.log(result.suggestions);
 * // ["Consider adding a deadline", "Specify which report"]
 * ```
 */
export async function enhanceDraft(
  input: ComposeAssistInput,
  options: ComposeAssistOptions = {}
): Promise<ComposeAssist> {
  const {
    model = DEFAULT_COMPOSE_MODEL,
    targetTone,
    fixGrammar = true,
    maxLength,
    systemPrompt = DEFAULT_COMPOSE_SYSTEM_PROMPT,
  } = options;

  // Build the prompt with context
  const contextParts: string[] = [];

  if (input.subject) {
    contextParts.push(`Subject: ${input.subject}`);
  }

  if (input.recipient) {
    contextParts.push(`Recipient: ${input.recipient}`);
  }

  if (input.intent) {
    contextParts.push(`Intent: ${input.intent}`);
  }

  const contextStr =
    contextParts.length > 0
      ? `Context:\n${contextParts.join("\n")}\n\n`
      : "";

  // Build requirements
  const requirements: string[] = [];

  if (targetTone) {
    requirements.push(`Adjust to a ${targetTone} tone`);
  }

  if (fixGrammar) {
    requirements.push("Fix any grammar and spelling errors");
  }

  if (maxLength) {
    requirements.push(`Keep the content under ${maxLength} words`);
  }

  const requirementsStr =
    requirements.length > 0
      ? `\n\nRequirements:\n${requirements.map((r) => `- ${r}`).join("\n")}`
      : "";

  const result = await generateObject({
    model: openai(model),
    schema: ComposeAssistSchema,
    system: systemPrompt,
    prompt: `${contextStr}Original draft:\n${input.draft}${requirementsStr}`,
  });

  return result.object;
}

/**
 * Draft a new email from scratch based on intent.
 *
 * Generates a complete email draft based on the provided intent
 * and context.
 *
 * @param input - The intent and context for the email
 * @param options - Optional configuration
 * @returns A compose assist result with the draft
 *
 * @example
 * ```typescript
 * const result = await draftEmail({
 *   intent: "Request time off for next week",
 *   recipient: "manager@company.com",
 *   keyPoints: ["Monday through Wednesday", "Family commitment"],
 *   tone: "professional"
 * });
 *
 * console.log(result.content);
 * // "Dear Manager,\n\nI am writing to request..."
 * ```
 */
export async function draftEmail(
  input: DraftEmailInput,
  options: DraftEmailOptions = {}
): Promise<ComposeAssist> {
  const { model = DEFAULT_COMPOSE_MODEL, maxLength, systemPrompt } = options;

  const customSystem =
    systemPrompt ||
    `You are an intelligent email writing assistant.
Draft a complete, ready-to-send email based on the user's intent.
The email should be clear, appropriate, and professional.
Don't include placeholder text like [Your Name] - keep it generic enough to work as-is.`;

  // Build the prompt
  const promptParts: string[] = [];

  promptParts.push(`Intent: ${input.intent}`);

  if (input.subject) {
    promptParts.push(`Subject: ${input.subject}`);
  }

  if (input.recipient) {
    promptParts.push(`Recipient: ${input.recipient}`);
  }

  if (input.tone) {
    promptParts.push(`Tone: ${input.tone}`);
  }

  if (input.keyPoints && input.keyPoints.length > 0) {
    promptParts.push(`Key points to include:\n${input.keyPoints.map((p) => `- ${p}`).join("\n")}`);
  }

  if (maxLength) {
    promptParts.push(`Maximum length: ${maxLength} words`);
  }

  const result = await generateObject({
    model: openai(model),
    schema: ComposeAssistSchema,
    system: customSystem,
    prompt: `Draft an email with the following requirements:\n\n${promptParts.join("\n")}`,
  });

  return result.object;
}

/**
 * Adjust the tone of an email.
 *
 * Rewrites the content to match the target tone while preserving
 * the original meaning and information.
 *
 * @param input - The content and target tone
 * @param options - Optional configuration
 * @returns The adjusted content
 *
 * @example
 * ```typescript
 * const result = await adjustTone({
 *   content: "Send me the file.",
 *   targetTone: "friendly"
 * });
 *
 * console.log(result.content);
 * // "Hi! Would you mind sending me the file when you get a chance? Thanks!"
 * ```
 */
export async function adjustTone(
  input: AdjustToneInput,
  options: Pick<ComposeAssistOptions, "model" | "systemPrompt"> = {}
): Promise<ComposeAssist> {
  const { model = DEFAULT_COMPOSE_MODEL, systemPrompt } = options;

  const customSystem =
    systemPrompt ||
    `You are an email tone adjustment assistant.
Rewrite the given content to match the target tone while:
1. Preserving all original information and intent
2. Maintaining appropriate length
3. Ensuring the result is ready to send`;

  const contextStr = input.context ? `\nContext: ${input.context}` : "";

  const result = await generateObject({
    model: openai(model),
    schema: ComposeAssistSchema,
    system: customSystem,
    prompt: `Adjust this email content to have a ${input.targetTone} tone:\n\nOriginal content:\n${input.content}${contextStr}`,
  });

  return result.object;
}

/**
 * Generate a subject line for an email.
 *
 * Creates an appropriate subject line based on the email content.
 *
 * @param content - The email body content
 * @param options - Optional configuration
 * @returns A suggested subject line
 *
 * @example
 * ```typescript
 * const subject = await generateSubjectLine(
 *   "Hi team, I wanted to schedule a meeting for next Tuesday to discuss Q4 goals."
 * );
 *
 * console.log(subject); // "Q4 Goals Discussion - Meeting Request"
 * ```
 */
export async function generateSubjectLine(
  content: string,
  options: Pick<ComposeAssistOptions, "model"> = {}
): Promise<string> {
  const { model = DEFAULT_COMPOSE_MODEL } = options;

  const result = await generateText({
    model: openai(model),
    system: `You are an email subject line generator.
Generate a clear, concise subject line (under 60 characters) that accurately describes the email content.
Return only the subject line, nothing else.`,
    prompt: `Generate a subject line for this email:\n\n${content}`,
  });

  return result.text.trim();
}
