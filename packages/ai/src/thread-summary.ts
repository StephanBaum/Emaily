/**
 * Thread summarization using AI.
 *
 * Provides functions for generating intelligent summaries of email threads,
 * extracting key points, action items, and overall sentiment using the
 * Vercel AI SDK with OpenAI.
 */

import { generateObject } from "ai";
import { openai } from "@ai-sdk/openai";
import { ThreadSummarySchema, type ThreadSummary } from "./schemas";

/**
 * Default model for thread summarization.
 */
const DEFAULT_THREAD_SUMMARY_MODEL = "gpt-4o";

/**
 * Represents a single message in an email thread.
 */
export interface ThreadMessage {
  /** Email sender address */
  from: string;
  /** Email recipients */
  to?: string[];
  /** Email subject line */
  subject: string;
  /** Email body content */
  body: string;
  /** When the message was sent */
  date: Date | string;
  /** Optional sender name */
  fromName?: string;
}

/**
 * Input for thread summarization.
 */
export interface SummarizeThreadInput {
  /** Array of messages in the thread, in chronological order */
  messages: ThreadMessage[];
  /** Optional thread subject (uses first message subject if not provided) */
  subject?: string;
}

/**
 * Options for thread summarization.
 */
export interface SummarizeThreadOptions {
  /** Override the default model */
  model?: string;
  /** Custom system prompt */
  systemPrompt?: string;
  /** Focus on specific aspects (e.g., decisions, action items) */
  focusAreas?: string[];
  /** Maximum summary length in words */
  maxSummaryLength?: number;
}

/**
 * Default system prompt for thread summarization.
 */
const DEFAULT_SYSTEM_PROMPT = `You are an intelligent email assistant that summarizes email threads.
Generate a comprehensive summary that helps users quickly understand the conversation.

Guidelines:
- Provide a concise 2-3 sentence summary of the overall discussion
- Extract key points and decisions made in the thread
- Identify any action items or next steps mentioned
- Determine the overall sentiment of the conversation
- Focus on the most important information
- Be objective and factual
- Maintain chronological context when relevant`;

/**
 * Summarize an email thread using AI.
 *
 * Analyzes all messages in the thread and generates a summary with
 * key points, action items, and overall sentiment.
 *
 * @param input - The thread messages to summarize
 * @param options - Optional configuration for summarization
 * @returns Thread summary with key points and action items
 *
 * @example
 * ```typescript
 * const result = await summarizeThread({
 *   messages: [
 *     {
 *       from: "alice@company.com",
 *       fromName: "Alice",
 *       subject: "Project Update",
 *       body: "We need to discuss the timeline...",
 *       date: new Date("2024-01-15")
 *     },
 *     {
 *       from: "bob@company.com",
 *       fromName: "Bob",
 *       subject: "Re: Project Update",
 *       body: "I agree, let's meet tomorrow...",
 *       date: new Date("2024-01-15")
 *     }
 *   ]
 * });
 *
 * console.log(result.summary);
 * console.log(result.keyPoints);
 * console.log(result.actionItems);
 * ```
 */
export async function summarizeThread(
  input: SummarizeThreadInput,
  options: SummarizeThreadOptions = {}
): Promise<ThreadSummary> {
  const {
    model = DEFAULT_THREAD_SUMMARY_MODEL,
    systemPrompt = DEFAULT_SYSTEM_PROMPT,
    focusAreas,
    maxSummaryLength,
  } = options;

  // Build the thread content string for the prompt
  const threadContent = buildThreadContent(input);

  // Build additional instructions
  const additionalInstructions = buildAdditionalInstructions({
    focusAreas,
    maxSummaryLength,
  });

  const result = await generateObject({
    model: openai(model),
    schema: ThreadSummarySchema,
    system: systemPrompt,
    prompt: `Summarize this email thread:\n\n${threadContent}\n\n${additionalInstructions}`,
  });

  return result.object;
}

/**
 * Build thread content string for the AI prompt.
 */
function buildThreadContent(input: SummarizeThreadInput): string {
  const { messages, subject } = input;
  const parts: string[] = [];

  // Add thread subject
  const threadSubject = subject || messages[0]?.subject || "Email Thread";
  parts.push(`Subject: ${threadSubject}`);
  parts.push(`Total Messages: ${messages.length}`);
  parts.push("");
  parts.push("--- Thread Messages (Chronological Order) ---");
  parts.push("");

  // Add each message
  messages.forEach((message, index) => {
    const messageNumber = index + 1;
    const fromDisplay = message.fromName
      ? `${message.fromName} <${message.from}>`
      : message.from;
    const dateDisplay =
      typeof message.date === "string" ? message.date : message.date.toISOString();

    parts.push(`Message ${messageNumber}:`);
    parts.push(`From: ${fromDisplay}`);
    if (message.to && message.to.length > 0) {
      parts.push(`To: ${message.to.join(", ")}`);
    }
    parts.push(`Date: ${dateDisplay}`);
    parts.push("");
    parts.push(message.body);
    parts.push("");
    parts.push("---");
    parts.push("");
  });

  return parts.join("\n");
}

/**
 * Build additional instructions for the prompt.
 */
function buildAdditionalInstructions(options: {
  focusAreas?: string[];
  maxSummaryLength?: number;
}): string {
  const { focusAreas, maxSummaryLength } = options;
  const parts: string[] = [];

  if (focusAreas && focusAreas.length > 0) {
    parts.push(`Focus especially on: ${focusAreas.join(", ")}`);
  }

  if (maxSummaryLength) {
    parts.push(`Keep the summary under ${maxSummaryLength} words.`);
  }

  if (parts.length === 0) {
    return "Provide a comprehensive summary.";
  }

  return parts.join("\n");
}
