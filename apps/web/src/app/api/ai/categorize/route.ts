/**
 * AI Email Categorization API Route
 *
 * Handles email categorization requests:
 * - POST /api/ai/categorize - Categorize an email using AI
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  categorizeEmail,
  type CategorizeEmailInput,
} from "@email-ai/ai";

/**
 * Request body for email categorization
 */
interface CategorizeRequest {
  /** Email subject line */
  subject: string;
  /** Email body content */
  body: string;
  /** Optional email sender */
  sender?: string;
  /** Optional recipient addresses */
  recipients?: string[];
}

/**
 * POST /api/ai/categorize
 * Categorize an email using AI
 *
 * Returns:
 * - category: important | promotional | social | updates | spam
 * - priority: 1-5
 * - summary: Brief summary of the email
 * - suggestedAction: reply | archive | delete | defer
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
      "/api/ai/categorize",
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
    let body: CategorizeRequest;
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

    // Build categorization input
    const input: CategorizeEmailInput = {
      subject: body.subject,
      body: body.body,
      sender: body.sender,
      recipients: body.recipients,
    };

    // Categorize the email using AI
    const result = await categorizeEmail(input);

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
