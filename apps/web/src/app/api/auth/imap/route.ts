/**
 * IMAP Account Creation API
 *
 * POST /api/auth/imap
 * Creates a new IMAP email account after validating the connection.
 * Encrypts the password before storing and links the account to the current user.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, CryptoError } from "@/lib/crypto";
import { createImapService } from "@/lib/email/imap";
import { createSmtpServiceFromImapConfig } from "@/lib/email/smtp";
import { EmailProviderError, ImapConfig } from "@/lib/email/types";

/**
 * Request body for creating IMAP account
 */
interface CreateImapAccountRequest {
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
 * Response structure for successful account creation
 */
interface CreateImapAccountResponse {
  success: true;
  accountId: string;
}

/**
 * Response structure for failed validation
 */
interface ValidationErrorResponse {
  success: false;
  error: string;
  imap?: {
    success: boolean;
    error?: string;
  };
  smtp?: {
    success: boolean;
    error?: string;
  };
}

/**
 * Validate the request body
 */
function validateRequest(body: unknown): body is CreateImapAccountRequest {
  if (!body || typeof body !== "object") {
    return false;
  }

  const req = body as Record<string, unknown>;

  return (
    typeof req.email === "string" &&
    req.email.length > 0 &&
    req.email.includes("@") &&
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

/**
 * POST /api/auth/imap
 * Create a new IMAP email account
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<CreateImapAccountResponse | ValidationErrorResponse | { error: string; message: string }>> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to add an email account" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

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

    // Test both connections before saving
    const [imapResult, smtpResult] = await Promise.allSettled([
      testImapConnection(config),
      testSmtpConnection(config),
    ]);

    // Process results
    const imapSuccess = imapResult.status === "fulfilled" && imapResult.value;
    const smtpSuccess = smtpResult.status === "fulfilled" && smtpResult.value;

    // If either connection fails, return validation error
    if (!imapSuccess || !smtpSuccess) {
      const imapError =
        imapResult.status === "rejected"
          ? formatError(imapResult.reason)
          : imapResult.value
            ? undefined
            : "Connection failed";

      const smtpError =
        smtpResult.status === "rejected"
          ? formatError(smtpResult.reason)
          : smtpResult.value
            ? undefined
            : "Connection failed";

      const response: ValidationErrorResponse = {
        success: false,
        error: "Connection validation failed. Please check your server settings.",
        imap: {
          success: imapSuccess,
          error: imapError,
        },
        smtp: {
          success: smtpSuccess,
          error: smtpError,
        },
      };

      return NextResponse.json(response, { status: 400 });
    }

    // Encrypt the password
    let encryptedPassword: string;
    try {
      encryptedPassword = encrypt(body.password);
    } catch (error) {
      if (error instanceof CryptoError) {
        return NextResponse.json(
          { error: "Server Configuration Error", message: "Encryption is not properly configured. Please contact support." },
          { status: 500 }
        );
      }
      throw error;
    }

    // Check if an IMAP account with this email already exists for this user
    const existingAccount = await prisma.emailAccount.findFirst({
      where: {
        userId,
        provider: "imap",
        email: body.email,
      },
    });

    if (existingAccount) {
      // Update existing account with new credentials
      const updatedAccount = await prisma.emailAccount.update({
        where: { id: existingAccount.id },
        data: {
          encryptedPassword,
          imapHost: body.imapHost,
          imapPort: body.imapPort,
          imapSecure: body.imapSecure,
          smtpHost: body.smtpHost,
          smtpPort: body.smtpPort,
          smtpSecure: body.smtpSecure,
          updatedAt: new Date(),
        },
      });

      const response: CreateImapAccountResponse = {
        success: true,
        accountId: updatedAccount.id,
      };

      return NextResponse.json(response);
    }

    // Create new EmailAccount
    const emailAccount = await prisma.emailAccount.create({
      data: {
        userId,
        provider: "imap",
        email: body.email,
        encryptedPassword,
        imapHost: body.imapHost,
        imapPort: body.imapPort,
        imapSecure: body.imapSecure,
        smtpHost: body.smtpHost,
        smtpPort: body.smtpPort,
        smtpSecure: body.smtpSecure,
      },
    });

    const response: CreateImapAccountResponse = {
      success: true,
      accountId: emailAccount.id,
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
