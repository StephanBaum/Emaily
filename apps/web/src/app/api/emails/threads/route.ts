/**
 * Email Threads API Routes
 *
 * Handles email thread listing:
 * - GET /api/emails/threads - List email threads with preview information
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Thread information with preview details
 */
interface EmailThread {
  /** Thread ID - null for emails without a thread */
  threadId: string | null;
  /** Subject from the most recent email in thread */
  subject: string;
  /** Unique participants in the thread */
  participants: string[];
  /** Number of messages in the thread */
  messageCount: number;
  /** Preview of the latest message body */
  preview: string;
  /** Whether all messages in thread are read */
  isRead: boolean;
  /** Whether any message in thread is starred */
  isStarred: boolean;
  /** Timestamp of the most recent message */
  lastMessageAt: Date;
  /** ID of the most recent email in the thread */
  latestEmailId: string;
}

/**
 * Query parameters for thread listing
 */
interface ThreadQueryParams {
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
  /** Filter by account ID */
  accountId?: string;
  /** Search query for subject/participants */
  search?: string;
  /** Sort field */
  sortBy?: "lastMessageAt" | "subject";
  /** Sort direction */
  sortOrder?: "asc" | "desc";
}

/**
 * Response structure for thread list
 */
interface ThreadListResponse {
  threads: EmailThread[];
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
function parseQueryParams(searchParams: URLSearchParams): ThreadQueryParams {
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
    accountId: searchParams.get("accountId") || undefined,
    search: searchParams.get("search") || undefined,
    sortBy:
      (searchParams.get("sortBy") as ThreadQueryParams["sortBy"]) || "lastMessageAt",
    sortOrder:
      (searchParams.get("sortOrder") as ThreadQueryParams["sortOrder"]) || "desc",
  };
}

/**
 * GET /api/emails/threads
 * List email threads with preview information
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to access threads" },
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
        threads: [],
        pagination: {
          page: params.page!,
          limit: params.limit!,
          total: 0,
          totalPages: 0,
        },
      } satisfies ThreadListResponse);
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

    // Build where clause for filtering
    const whereClause: Parameters<typeof prisma.email.findMany>[0]["where"] = {
      accountId: { in: validAccountIds },
    };

    // Apply filters
    if (params.category) {
      whereClause.category = params.category;
    }
    if (params.search) {
      whereClause.OR = [
        { subject: { contains: params.search, mode: "insensitive" } },
        { sender: { contains: params.search, mode: "insensitive" } },
      ];
    }

    // Get all emails matching the filters
    const emails = await prisma.email.findMany({
      where: whereClause,
      orderBy: { receivedAt: "desc" },
    });

    // Group emails by threadId
    const threadMap = new Map<string | null, typeof emails>();

    for (const email of emails) {
      const threadKey = email.threadId || `single_${email.id}`;
      if (!threadMap.has(threadKey)) {
        threadMap.set(threadKey, []);
      }
      threadMap.get(threadKey)!.push(email);
    }

    // Build thread objects
    let threads: EmailThread[] = Array.from(threadMap.entries()).map(([threadKey, threadEmails]) => {
      // Sort emails in thread by receivedAt descending
      const sortedEmails = threadEmails.sort(
        (a, b) => b.receivedAt.getTime() - a.receivedAt.getTime()
      );
      const latestEmail = sortedEmails[0];

      // Extract unique participants
      const participantsSet = new Set<string>();
      threadEmails.forEach(email => {
        participantsSet.add(email.sender);
        email.recipients.forEach(recipient => participantsSet.add(recipient));
      });

      // Check read and starred status
      const allRead = threadEmails.every(email => email.isRead);
      const anyStarred = threadEmails.some(email => email.isStarred);

      // Generate preview from body (first 100 chars)
      const preview = latestEmail.body
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 100);

      return {
        threadId: threadKey.startsWith("single_") ? null : threadKey,
        subject: latestEmail.subject,
        participants: Array.from(participantsSet),
        messageCount: threadEmails.length,
        preview,
        isRead: allRead,
        isStarred: anyStarred,
        lastMessageAt: latestEmail.receivedAt,
        latestEmailId: latestEmail.id,
      };
    });

    // Apply read/starred filters to threads
    if (params.isRead !== undefined) {
      threads = threads.filter(thread => thread.isRead === params.isRead);
    }
    if (params.isStarred !== undefined) {
      threads = threads.filter(thread => thread.isStarred === params.isStarred);
    }

    // Sort threads
    threads.sort((a, b) => {
      const aValue = params.sortBy === "subject" ? a.subject : a.lastMessageAt.getTime();
      const bValue = params.sortBy === "subject" ? b.subject : b.lastMessageAt.getTime();

      if (params.sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

    // Calculate pagination
    const total = threads.length;
    const totalPages = Math.ceil(total / params.limit!);
    const skip = (params.page! - 1) * params.limit!;
    const paginatedThreads = threads.slice(skip, skip + params.limit!);

    const response: ThreadListResponse = {
      threads: paginatedThreads,
      pagination: {
        page: params.page!,
        limit: params.limit!,
        total,
        totalPages,
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
