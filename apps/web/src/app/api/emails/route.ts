/**
 * Email List API Routes
 *
 * Handles email listing and batch operations:
 * - GET /api/emails - List emails with filtering and pagination
 * - POST /api/emails - Batch operations on multiple emails
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, type Email } from "@/lib/prisma";

/**
 * Query parameters for email listing
 */
interface EmailQueryParams {
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default 50, max 100) */
  limit?: number;
  /** Filter by category */
  category?: string;
  /** Filter by read status */
  isRead?: boolean;
  /** Filter by starred status */
  isStarred?: boolean;
  /** Filter by attachment status */
  hasAttachments?: boolean;
  /** Filter by account ID */
  accountId?: string;
  /** Search query for subject/sender */
  search?: string;
  /** Sort field */
  sortBy?: "receivedAt" | "sender" | "subject";
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

/**
 * Response structure for email list
 */
interface EmailListResponse {
  emails: Email[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Parse query parameters from URL
 */
function parseQueryParams(searchParams: URLSearchParams): EmailQueryParams {
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(
    parseInt(searchParams.get("limit") || "50", 10),
    100
  );

  return {
    page: Math.max(1, page),
    limit: Math.max(1, limit),
    category: searchParams.get("category") || undefined,
    isRead: searchParams.has("isRead")
      ? searchParams.get("isRead") === "true"
      : undefined,
    isStarred: searchParams.has("isStarred")
      ? searchParams.get("isStarred") === "true"
      : undefined,
    hasAttachments: searchParams.has("hasAttachments")
      ? searchParams.get("hasAttachments") === "true"
      : undefined,
    accountId: searchParams.get("accountId") || undefined,
    search: searchParams.get("search") || undefined,
    sortBy:
      (searchParams.get("sortBy") as EmailQueryParams["sortBy"]) || "receivedAt",
    sortOrder:
      (searchParams.get("sortOrder") as EmailQueryParams["sortOrder"]) || "desc",
  };
}

/**
 * GET /api/emails
 * List emails with filtering and pagination
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to access emails" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse query parameters
    const params = parseQueryParams(request.nextUrl.searchParams);

    // Get user's email accounts
    const emailAccounts = await prisma.emailAccount.findMany({
      where: { userId },
      select: { id: true },
    });

    if (emailAccounts.length === 0) {
      // No connected accounts - return empty result
      return NextResponse.json({
        emails: [],
        pagination: {
          page: params.page!,
          limit: params.limit!,
          total: 0,
          totalPages: 0,
        },
      } satisfies EmailListResponse);
    }

    const accountIds = params.accountId
      ? [params.accountId]
      : emailAccounts.map((a) => a.id);

    // Verify user owns the requested account(s)
    const validAccountIds = accountIds.filter((id) =>
      emailAccounts.some((a) => a.id === id)
    );

    if (validAccountIds.length === 0) {
      return NextResponse.json(
        { error: "Forbidden", message: "You don't have access to this account" },
        { status: 403 }
      );
    }

    // Build where clause
    const whereClause: Parameters<typeof prisma.email.findMany>[0]["where"] = {
      accountId: { in: validAccountIds },
    };

    // Apply filters
    if (params.category) {
      whereClause.category = params.category;
    }
    if (params.isRead !== undefined) {
      whereClause.isRead = params.isRead;
    }
    if (params.isStarred !== undefined) {
      whereClause.isStarred = params.isStarred;
    }
    if (params.hasAttachments !== undefined) {
      whereClause.hasAttachments = params.hasAttachments;
    }
    if (params.search) {
      whereClause.OR = [
        { subject: { contains: params.search, mode: "insensitive" } },
        { sender: { contains: params.search, mode: "insensitive" } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.email.count({ where: whereClause });

    // Fetch emails with pagination
    const emails = await prisma.email.findMany({
      where: whereClause,
      orderBy: { [params.sortBy!]: params.sortOrder },
      skip: (params.page! - 1) * params.limit!,
      take: params.limit,
    });

    const response: EmailListResponse = {
      emails,
      pagination: {
        page: params.page!,
        limit: params.limit!,
        total,
        totalPages: Math.ceil(total / params.limit!),
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
 * Batch operation types
 */
interface BatchOperationRequest {
  /** Email IDs to operate on */
  emailIds: string[];
  /** Operation to perform */
  operation: "markRead" | "markUnread" | "star" | "unstar" | "archive" | "trash" | "delete";
}

/**
 * POST /api/emails
 * Perform batch operations on multiple emails
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to access emails" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    let body: BatchOperationRequest;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate request
    if (!body.emailIds || !Array.isArray(body.emailIds) || body.emailIds.length === 0) {
      return NextResponse.json(
        { error: "Bad Request", message: "emailIds must be a non-empty array" },
        { status: 400 }
      );
    }

    if (!body.operation) {
      return NextResponse.json(
        { error: "Bad Request", message: "operation is required" },
        { status: 400 }
      );
    }

    const validOperations = ["markRead", "markUnread", "star", "unstar", "archive", "trash", "delete"];
    if (!validOperations.includes(body.operation)) {
      return NextResponse.json(
        { error: "Bad Request", message: `operation must be one of: ${validOperations.join(", ")}` },
        { status: 400 }
      );
    }

    // Get user's email accounts
    const emailAccounts = await prisma.emailAccount.findMany({
      where: { userId },
      select: { id: true },
    });

    const accountIds = emailAccounts.map((a) => a.id);

    // Verify user owns all the emails
    const emails = await prisma.email.findMany({
      where: {
        id: { in: body.emailIds },
        accountId: { in: accountIds },
      },
      select: { id: true },
    });

    const ownedEmailIds = emails.map((e) => e.id);
    const unauthorizedIds = body.emailIds.filter((id) => !ownedEmailIds.includes(id));

    if (unauthorizedIds.length > 0) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "You don't have access to some of the specified emails",
          unauthorizedIds,
        },
        { status: 403 }
      );
    }

    // Perform the batch operation
    let updateData: Parameters<typeof prisma.email.updateMany>[0]["data"] = {};

    switch (body.operation) {
      case "markRead":
        updateData = { isRead: true };
        break;
      case "markUnread":
        updateData = { isRead: false };
        break;
      case "star":
        updateData = { isStarred: true };
        break;
      case "unstar":
        updateData = { isStarred: false };
        break;
      case "archive":
        // For archive, we don't delete from DB, just update a category or similar
        // This is a simplified implementation - in production would sync with provider
        updateData = { category: "archived" };
        break;
      case "trash":
        // For trash, update category (would sync with provider in production)
        updateData = { category: "trash" };
        break;
      case "delete":
        // Permanently delete from database
        await prisma.email.deleteMany({
          where: { id: { in: ownedEmailIds } },
        });
        return NextResponse.json({
          success: true,
          message: `Deleted ${ownedEmailIds.length} email(s)`,
          affectedCount: ownedEmailIds.length,
        });
    }

    // Update emails
    const result = await prisma.email.updateMany({
      where: { id: { in: ownedEmailIds } },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      message: `${body.operation} applied to ${result.count} email(s)`,
      affectedCount: result.count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
