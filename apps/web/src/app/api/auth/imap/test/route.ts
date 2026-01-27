/**
 * IMAP/SMTP Connection Test API
 *
 * POST /api/auth/imap/test
 * Tests IMAP and SMTP server connections without saving credentials.
 * Used to validate configuration before linking an account.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createImapService } from "@/lib/email/imap";
import { createSmtpServiceFromImapConfig } from "@/lib/email/smtp";
import { EmailProviderError, ImapConfig } from "@/lib/email/types";

/**
 * Request body for testing IMAP/SMTP connection
 */
interface TestConnectionRequest {
  /** User's email address */
  email: string;
  /** Email account password */
  password: string;
  /** IMAP server hostname */
  imapHost: string;
  /** IMAP server port (993 for TLS, 143 for STARTTLS) */
  imapPort: number;
  /** Whether IMAP uses TLS (true for port 993) */
  imapSecure: boolean;
  /** SMTP server hostname */
  smtpHost: string;
  /** SMTP server port (587 for STARTTLS, 465 for TLS) */
  smtpPort: number;
  /** Whether SMTP uses TLS (true for port 465) */
  smtpSecure: boolean;
}

/**
 * Response structure for connection test
 */
interface TestConnectionResponse {
  success: boolean;
  imap: {
    success: boolean;
    error?: string;
  };
  smtp: {
    success: boolean;
    error?: string;
  };
}

/**
 * Validate the request body
 */
function validateRequest(body: unknown): body is TestConnectionRequest {
  if (!body || typeof body !== "object") {
    return false;
  }

  const req = body as Record<string, unknown>;

  return (
    typeof req.email === "string" &&
    req.email.length > 0 &&
    typeof req.password === "string" &&
    req.password.length > 0 &&
    typeof req.imapHost === "string" &&
    req.imapHost.length > 0 &&
    typeof req.imapPort === "number" &&
    req.imapPort > 0 &&
    req.imapPort <= 65535 &&
    typeof req.imapSecure === "boolean" &&
    typeof req.smtpHost === "string" &&
    req.smtpHost.length > 0 &&
    typeof req.smtpPort === "number" &&
    req.smtpPort > 0 &&
    req.smtpPort <= 65535 &&
    typeof req.smtpSecure === "boolean"
  );
}

/**
 * POST /api/auth/imap/test
 * Test IMAP and SMTP connection with provided credentials
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to test connections" },
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate request
    if (!validateRequest(body)) {
      return NextResponse.json(
        {
          error: "Bad Request",
          message: "Invalid request body. Required: email, password, imapHost, imapPort, imapSecure, smtpHost, smtpPort, smtpSecure",
        },
        { status: 400 }
      );
    }

    // Build IMAP config
    const config: ImapConfig = {
      email: body.email,
      password: body.password,
      imapHost: body.imapHost,
      imapPort: body.imapPort,
      imapSecure: body.imapSecure,
      smtpHost: body.smtpHost,
      smtpPort: body.smtpPort,
      smtpSecure: body.smtpSecure,
    };

    // Test both connections concurrently
    const [imapResult, smtpResult] = await Promise.allSettled([
      testImapConnection(config),
      testSmtpConnection(config),
    ]);

    // Process IMAP result
    const imapSuccess = imapResult.status === "fulfilled" && imapResult.value;
    const imapError =
      imapResult.status === "rejected"
        ? formatError(imapResult.reason)
        : imapResult.value
          ? undefined
          : "Connection failed";

    // Process SMTP result
    const smtpSuccess = smtpResult.status === "fulfilled" && smtpResult.value;
    const smtpError =
      smtpResult.status === "rejected"
        ? formatError(smtpResult.reason)
        : smtpResult.value
          ? undefined
          : "Connection failed";

    const response: TestConnectionResponse = {
      success: imapSuccess && smtpSuccess,
      imap: {
        success: imapSuccess,
        error: imapError,
      },
      smtp: {
        success: smtpSuccess,
        error: smtpError,
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

/**
 * Test IMAP connection
 */
async function testImapConnection(config: ImapConfig): Promise<boolean> {
  const imapService = createImapService(config);
  try {
    const result = await imapService.testConnection();
    return result;
  } finally {
    await imapService.disconnect();
  }
}

/**
 * Test SMTP connection
 */
async function testSmtpConnection(config: ImapConfig): Promise<boolean> {
  const smtpService = createSmtpServiceFromImapConfig(config);
  try {
    await smtpService.verifyConnection();
    return true;
  } finally {
    smtpService.close();
  }
}

/**
 * Format error message for response
 */
function formatError(error: unknown): string {
  if (error instanceof EmailProviderError) {
    // Return user-friendly message based on error type
    switch (error.type) {
      case "authentication":
        return "Authentication failed. Please check your email and password.";
      case "network_error":
        return "Could not connect to server. Please check the hostname and port.";
      case "authorization":
        return "Access denied. Your email provider may require an app-specific password.";
      default:
        return error.message;
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown error occurred";
}
