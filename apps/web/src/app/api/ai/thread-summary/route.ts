/**
 * AI Thread Summary API Route
 *
 * Handles thread summarization requests:
 * - POST /api/ai/thread-summary - Generate an AI summary of an email thread
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  summarizeThread,
  type SummarizeThreadInput,
  type SummarizeThreadOptions,
  type ThreadMessage,
} from "@email-ai/ai";

/**
 * Request body for thread summarization
 */
interface ThreadSummaryRequest {
  /** Array of messages in the thread, in chronological order */
  messages: ThreadMessage[];
  /** Optional thread subject (uses first message subject if not provided) */
  subject?: string;
  /** Focus on specific aspects (e.g., decisions, action items) */
  focusAreas?: string[];
  /** Maximum summary length in words */
  maxSummaryLength?: number;
  /** Override the default model */
  model?: string;
}

/**
 * POST /api/ai/thread-summary
 * Generate an AI summary of an email thread
 *
 * Returns:
 * - summary: A concise summary of the entire thread
 * - keyPoints: Key points and decisions from the discussion
 * - actionItems: Action items mentioned in the thread
 * - sentiment: Overall sentiment of the conversation
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to use AI features" },
        { status: 401 }
      );
    }

    // Check rate limit
    const rateLimitResult = await rateLimit(
      session.user.id,
      "/api/ai/thread-summary",
      RATE_LIMITS.AI
    );

    if (!rateLimitResult.success) {
      const retryAfter = Math.ceil(
        (rateLimitResult.reset.getTime() - Date.now()) / 1000
      );

      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: `Too many requests. Please try again in ${retryAfter} seconds.`,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfter),
            "X-RateLimit-Limit": String(RATE_LIMITS.AI.limit),
            "X-RateLimit-Remaining": String(rateLimitResult.remaining),
            "X-RateLimit-Reset": rateLimitResult.reset.toISOString(),
          },
        }
      );
    }

    // Parse request body
    let body: ThreadSummaryRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.messages || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: "Bad Request", message: "messages is required and must be an array" },
        { status: 400 }
      );
    }

    if (body.messages.length === 0) {
      return NextResponse.json(
        { error: "Bad Request", message: "messages array cannot be empty" },
        { status: 400 }
      );
    }

    // Validate each message has required fields
    for (let i = 0; i < body.messages.length; i++) {
      const msg = body.messages[i];
      if (!msg.from || typeof msg.from !== "string") {
        return NextResponse.json(
          { error: "Bad Request", message: `messages[${i}].from is required and must be a string` },
          { status: 400 }
        );
      }
      if (!msg.subject || typeof msg.subject !== "string") {
        return NextResponse.json(
          { error: "Bad Request", message: `messages[${i}].subject is required and must be a string` },
          { status: 400 }
        );
      }
      if (!msg.body || typeof msg.body !== "string") {
        return NextResponse.json(
          { error: "Bad Request", message: `messages[${i}].body is required and must be a string` },
          { status: 400 }
        );
      }
      if (!msg.date) {
        return NextResponse.json(
          { error: "Bad Request", message: `messages[${i}].date is required` },
          { status: 400 }
        );
      }
    }

    // Validate optional parameters
    if (body.focusAreas && !Array.isArray(body.focusAreas)) {
      return NextResponse.json(
        { error: "Bad Request", message: "focusAreas must be an array" },
        { status: 400 }
      );
    }

    if (body.maxSummaryLength !== undefined) {
      if (typeof body.maxSummaryLength !== "number" || body.maxSummaryLength < 10 || body.maxSummaryLength > 1000) {
        return NextResponse.json(
          { error: "Bad Request", message: "maxSummaryLength must be a number between 10 and 1000" },
          { status: 400 }
        );
      }
    }

    // Build thread summary input
    const input: SummarizeThreadInput = {
      messages: body.messages,
      subject: body.subject,
    };

    // Build options
    const options: SummarizeThreadOptions = {
      focusAreas: body.focusAreas,
      maxSummaryLength: body.maxSummaryLength,
      model: body.model,
    };

    // Generate thread summary
    const result = await summarizeThread(input, options);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    // Handle specific AI SDK errors
    if (error instanceof Error) {
      // Check for API key errors
      if (error.message.includes("API key")) {
        return NextResponse.json(
          { error: "Configuration Error", message: "AI service is not properly configured" },
          { status: 503 }
        );
      }

      // Check for rate limit errors
      if (error.message.includes("rate limit") || error.message.includes("429")) {
        return NextResponse.json(
          { error: "Rate Limited", message: "AI service is temporarily unavailable. Please try again later." },
          { status: 429 }
        );
      }
    }

    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
