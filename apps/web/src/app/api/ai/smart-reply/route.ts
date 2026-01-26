/**
 * AI Smart Reply Generation API Route
 *
 * Handles smart reply generation requests:
 * - POST /api/ai/smart-reply - Generate smart reply suggestions for an email
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  generateSmartReplies,
  generateSmartReplyWithTone,
  type SmartReplyInput,
  type ReplyTone,
} from "@email-ai/ai";

/**
 * Request body for smart reply generation
 */
interface SmartReplyRequest {
  /** Email subject line */
  subject: string;
  /** Email body content */
  body: string;
  /** Optional email sender */
  sender?: string;
  /** Optional thread context (previous emails) */
  threadContext?: string;
  /** Number of replies to generate (default: 3) */
  replyCount?: number;
  /** Preferred tones for replies */
  preferredTones?: ReplyTone[];
  /** User's name for personalization */
  userName?: string;
  /** Single specific tone (alternative to generating multiple) */
  singleTone?: ReplyTone;
}

/**
 * POST /api/ai/smart-reply
 * Generate smart reply suggestions for an email
 *
 * Returns:
 * - replies: Array of reply suggestions with tone, content, and isShort flag
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

    // Parse request body
    let body: SmartReplyRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.subject || typeof body.subject !== "string") {
      return NextResponse.json(
        { error: "Bad Request", message: "subject is required and must be a string" },
        { status: 400 }
      );
    }

    if (!body.body || typeof body.body !== "string") {
      return NextResponse.json(
        { error: "Bad Request", message: "body is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate optional parameters
    const validTones: ReplyTone[] = ["formal", "casual", "friendly", "professional"];

    if (body.singleTone && !validTones.includes(body.singleTone)) {
      return NextResponse.json(
        { error: "Bad Request", message: `singleTone must be one of: ${validTones.join(", ")}` },
        { status: 400 }
      );
    }

    if (body.preferredTones) {
      const invalidTones = body.preferredTones.filter((t) => !validTones.includes(t));
      if (invalidTones.length > 0) {
        return NextResponse.json(
          { error: "Bad Request", message: `Invalid tones: ${invalidTones.join(", ")}. Must be: ${validTones.join(", ")}` },
          { status: 400 }
        );
      }
    }

    if (body.replyCount !== undefined && (typeof body.replyCount !== "number" || body.replyCount < 1 || body.replyCount > 5)) {
      return NextResponse.json(
        { error: "Bad Request", message: "replyCount must be a number between 1 and 5" },
        { status: 400 }
      );
    }

    // Build smart reply input
    const input: SmartReplyInput = {
      subject: body.subject,
      body: body.body,
      sender: body.sender,
      threadContext: body.threadContext,
    };

    // Generate replies
    if (body.singleTone) {
      // Generate a single reply with specific tone
      const reply = await generateSmartReplyWithTone(input, body.singleTone, {
        userName: body.userName || session.user.name || undefined,
      });

      return NextResponse.json({
        success: true,
        replies: [reply],
      });
    } else {
      // Generate multiple reply suggestions
      const result = await generateSmartReplies(input, {
        replyCount: body.replyCount || 3,
        preferredTones: body.preferredTones,
        userName: body.userName || session.user.name || undefined,
      });

      return NextResponse.json({
        success: true,
        ...result,
      });
    }
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
