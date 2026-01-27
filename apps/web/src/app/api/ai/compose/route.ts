/**
 * AI Email Composition Assistance API Route
 *
 * Handles email composition assistance requests:
 * - POST /api/ai/compose - AI-assisted email composition operations
 *
 * Supports multiple operations:
 * - enhance: Improve an existing draft
 * - draft: Generate a new email from intent
 * - adjustTone: Change the tone of content
 * - generateSubject: Create a subject line for content
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  enhanceDraft,
  draftEmail,
  adjustTone,
  generateSubjectLine,
  type ReplyTone,
} from "@email-ai/ai";

/**
 * Valid operation types for compose API
 */
type ComposeOperation = "enhance" | "draft" | "adjustTone" | "generateSubject";

/**
 * Base request body
 */
interface BaseComposeRequest {
  /** The operation to perform */
  operation: ComposeOperation;
}

/**
 * Request body for enhance operation
 */
interface EnhanceRequest extends BaseComposeRequest {
  operation: "enhance";
  /** The draft content to enhance */
  draft: string;
  /** Optional subject line for context */
  subject?: string;
  /** Optional recipient information */
  recipient?: string;
  /** Optional context about the email's purpose */
  intent?: string;
  /** Target tone for enhancement */
  targetTone?: ReplyTone;
  /** Whether to fix grammar (default: true) */
  fixGrammar?: boolean;
  /** Maximum length in words */
  maxLength?: number;
}

/**
 * Request body for draft operation
 */
interface DraftRequest extends BaseComposeRequest {
  operation: "draft";
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
  /** Maximum length in words */
  maxLength?: number;
}

/**
 * Request body for adjustTone operation
 */
interface AdjustToneRequest extends BaseComposeRequest {
  operation: "adjustTone";
  /** The content to adjust */
  content: string;
  /** The target tone */
  targetTone: ReplyTone;
  /** Optional context */
  context?: string;
}

/**
 * Request body for generateSubject operation
 */
interface GenerateSubjectRequest extends BaseComposeRequest {
  operation: "generateSubject";
  /** The email body content */
  content: string;
}

/**
 * Union type for all compose request types
 */
type ComposeRequest =
  | EnhanceRequest
  | DraftRequest
  | AdjustToneRequest
  | GenerateSubjectRequest;

/**
 * Valid tones for compose operations
 */
const VALID_TONES: ReplyTone[] = ["formal", "casual", "friendly", "professional"];

/**
 * Validate tone parameter
 */
function isValidTone(tone: unknown): tone is ReplyTone {
  return typeof tone === "string" && VALID_TONES.includes(tone as ReplyTone);
}

/**
 * POST /api/ai/compose
 * AI-assisted email composition operations
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
      "/api/ai/compose",
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
    let body: ComposeRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate operation
    const validOperations: ComposeOperation[] = ["enhance", "draft", "adjustTone", "generateSubject"];
    if (!body.operation || !validOperations.includes(body.operation)) {
      return NextResponse.json(
        { error: "Bad Request", message: `operation must be one of: ${validOperations.join(", ")}` },
        { status: 400 }
      );
    }

    // Handle each operation type
    switch (body.operation) {
      case "enhance": {
        const enhanceBody = body as EnhanceRequest;

        // Validate required fields
        if (!enhanceBody.draft || typeof enhanceBody.draft !== "string") {
          return NextResponse.json(
            { error: "Bad Request", message: "draft is required and must be a string" },
            { status: 400 }
          );
        }

        // Validate optional tone
        if (enhanceBody.targetTone && !isValidTone(enhanceBody.targetTone)) {
          return NextResponse.json(
            { error: "Bad Request", message: `targetTone must be one of: ${VALID_TONES.join(", ")}` },
            { status: 400 }
          );
        }

        const result = await enhanceDraft(
          {
            draft: enhanceBody.draft,
            subject: enhanceBody.subject,
            recipient: enhanceBody.recipient,
            intent: enhanceBody.intent,
          },
          {
            targetTone: enhanceBody.targetTone,
            fixGrammar: enhanceBody.fixGrammar ?? true,
            maxLength: enhanceBody.maxLength,
          }
        );

        return NextResponse.json({
          success: true,
          operation: "enhance",
          ...result,
        });
      }

      case "draft": {
        const draftBody = body as DraftRequest;

        // Validate required fields
        if (!draftBody.intent || typeof draftBody.intent !== "string") {
          return NextResponse.json(
            { error: "Bad Request", message: "intent is required and must be a string" },
            { status: 400 }
          );
        }

        // Validate optional tone
        if (draftBody.tone && !isValidTone(draftBody.tone)) {
          return NextResponse.json(
            { error: "Bad Request", message: `tone must be one of: ${VALID_TONES.join(", ")}` },
            { status: 400 }
          );
        }

        // Validate keyPoints if provided
        if (draftBody.keyPoints && !Array.isArray(draftBody.keyPoints)) {
          return NextResponse.json(
            { error: "Bad Request", message: "keyPoints must be an array of strings" },
            { status: 400 }
          );
        }

        const result = await draftEmail(
          {
            intent: draftBody.intent,
            subject: draftBody.subject,
            recipient: draftBody.recipient,
            keyPoints: draftBody.keyPoints,
            tone: draftBody.tone,
          },
          {
            maxLength: draftBody.maxLength,
          }
        );

        return NextResponse.json({
          success: true,
          operation: "draft",
          ...result,
        });
      }

      case "adjustTone": {
        const adjustBody = body as AdjustToneRequest;

        // Validate required fields
        if (!adjustBody.content || typeof adjustBody.content !== "string") {
          return NextResponse.json(
            { error: "Bad Request", message: "content is required and must be a string" },
            { status: 400 }
          );
        }

        if (!adjustBody.targetTone || !isValidTone(adjustBody.targetTone)) {
          return NextResponse.json(
            { error: "Bad Request", message: `targetTone is required and must be one of: ${VALID_TONES.join(", ")}` },
            { status: 400 }
          );
        }

        const result = await adjustTone({
          content: adjustBody.content,
          targetTone: adjustBody.targetTone,
          context: adjustBody.context,
        });

        return NextResponse.json({
          success: true,
          operation: "adjustTone",
          ...result,
        });
      }

      case "generateSubject": {
        const subjectBody = body as GenerateSubjectRequest;

        // Validate required fields
        if (!subjectBody.content || typeof subjectBody.content !== "string") {
          return NextResponse.json(
            { error: "Bad Request", message: "content is required and must be a string" },
            { status: 400 }
          );
        }

        const subject = await generateSubjectLine(subjectBody.content);

        return NextResponse.json({
          success: true,
          operation: "generateSubject",
          subject,
        });
      }

      default:
        return NextResponse.json(
          { error: "Bad Request", message: "Unknown operation" },
          { status: 400 }
        );
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
