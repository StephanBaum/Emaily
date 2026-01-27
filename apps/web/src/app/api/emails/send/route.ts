/**
 * Send Email API Route
 *
 * Handles sending emails through the user's connected email provider:
 * - POST /api/emails/send - Send a new email
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createEmailProvider,
  type SendEmailOptions,
  type SendEmailResult,
  EmailProviderError,
} from "@/lib/email";

/**
 * Send email request body structure
 */
interface SendEmailRequest {
  /** Recipient email addresses */
  to: string[];
  /** CC recipients */
  cc?: string[];
  /** BCC recipients */
  bcc?: string[];
  /** Email subject */
  subject: string;
  /** Plain text body */
  bodyText?: string;
  /** HTML body */
  bodyHtml?: string;
  /** Thread ID for replies */
  threadId?: string;
  /** Message ID being replied to (for In-Reply-To header) */
  inReplyTo?: string;
  /** Optional account ID to send from (uses first account if not specified) */
  accountId?: string;
}

/**
 * Send email response structure
 */
interface SendEmailResponse {
  success: boolean;
  message: string;
  result?: {
    messageId: string;
    threadId: string;
    labels: string[];
  };
}

/**
 * Validate email address format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * POST /api/emails/send
 * Send a new email through the user's connected email provider
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to send emails" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    let body: SendEmailRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate required fields
    if (!body.to || !Array.isArray(body.to) || body.to.length === 0) {
      return NextResponse.json(
        { error: "Bad Request", message: "to is required and must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!body.subject || typeof body.subject !== "string") {
      return NextResponse.json(
        { error: "Bad Request", message: "subject is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate at least one body is provided
    if (!body.bodyText && !body.bodyHtml) {
      return NextResponse.json(
        { error: "Bad Request", message: "Either bodyText or bodyHtml is required" },
        { status: 400 }
      );
    }

    // Validate email addresses
    const allRecipients = [
      ...body.to,
      ...(body.cc || []),
      ...(body.bcc || []),
    ];

    const invalidEmails = allRecipients.filter((email) => !isValidEmail(email));
    if (invalidEmails.length > 0) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: `Invalid email address(es): ${invalidEmails.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Get user's email account
    const account = body.accountId
      ? await prisma.emailAccount.findFirst({
          where: { id: body.accountId, userId },
        })
      : await prisma.emailAccount.findFirst({
          where: { userId },
        });

    if (!account) {
      if (body.accountId) {
        return NextResponse.json(
          { error: "Not Found", message: "Email account not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Not Found", message: "No email accounts connected. Please connect an email account first." },
        { status: 404 }
      );
    }

    // Map provider name to EmailProvider type
    const providerType = account.provider === "gmail" ? "google" : "microsoft";

    // Create email provider
    const emailProvider = createEmailProvider(providerType, {
      accessToken: account.accessToken,
      refreshToken: account.refreshToken,
    });

    // Prepare send options
    const sendOptions: SendEmailOptions = {
      to: body.to,
      cc: body.cc,
      bcc: body.bcc,
      subject: body.subject,
      bodyText: body.bodyText,
      bodyHtml: body.bodyHtml,
      threadId: body.threadId,
      inReplyTo: body.inReplyTo,
    };

    // Send the email
    let result: SendEmailResult;
    try {
      result = await emailProvider.sendEmail(sendOptions);
    } catch (error) {
      // Handle email provider errors
      if (error instanceof EmailProviderError) {
        const statusCode = error.requiresReauth ? 401 : error.isRetryable ? 503 : 500;
        return NextResponse.json(
          {
            error: error.requiresReauth ? "Authentication Required" : "Email Provider Error",
            message: error.message,
            type: error.type,
          },
          { status: statusCode }
        );
      }

      // Re-throw unexpected errors
      throw error;
    }

    // Return success response
    const response: SendEmailResponse = {
      success: true,
      message: "Email sent successfully",
      result: {
        messageId: result.messageId,
        threadId: result.threadId,
        labels: result.labels,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
