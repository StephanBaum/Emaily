/**
 * Email Search API Routes
 *
 * Handles advanced email search with full-text search:
 * - GET /api/emails/search - Search emails with filters and pagination
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, type Email } from "@/lib/prisma";
import {
  buildHeadlineOptions,
  sanitizeHighlight,
  DEFAULT_HIGHLIGHT_CONFIG,
} from "@/lib/email/search-highlight";

/**
 * Query parameters for email search
 */
interface SearchQueryParams {
  /** Search query (full-text search) */
  q?: string;
  /** Page number (1-indexed) */
  page?: number;
  /** Items per page (default 50, max 100) */
  limit?: number;
  /** Filter by sender email or name */
  sender?: string;
  /** Filter by date from (ISO string) */
  dateFrom?: string;
  /** Filter by date to (ISO string) */
  dateTo?: string;
  /** Filter by attachment presence */
  hasAttachments?: boolean;
  /** Filter by category */
  category?: string;
  /** Filter by read status */
  isRead?: boolean;
  /** Filter by account ID */
  accountId?: string;
  /** Sort field */
  sortBy?: "relevance" | "receivedAt" | "sender" | "subject";
  /** Sort direction */
  sortOrder?: "asc" | "desc";
  /** Enable search result highlighting */
  highlight?: boolean;
}

/**
 * Search result with relevance score and optional highlights
 */
interface SearchResultEmail extends Email {
  relevanceScore?: number;
  subjectHighlight?: string;
  bodyHighlight?: string;
  senderHighlight?: string;
}

/**
 * Response structure for search results
 */
interface SearchResponse {
  emails: SearchResultEmail[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  query: {
    searchTerm?: string;
    filters: {
      sender?: string;
      dateFrom?: string;
      dateTo?: string;
      hasAttachments?: boolean;
      category?: string;
      isRead?: boolean;
    };
  };
}

/**
 * Parse query parameters from URL
 */
function parseSearchParams(searchParams: URLSearchParams): SearchQueryParams {
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(
    parseInt(searchParams.get("limit") || "50", 10),
    100
  );

  return {
    q: searchParams.get("q") || undefined,
    page: Math.max(1, page),
    limit: Math.max(1, limit),
    sender: searchParams.get("sender") || undefined,
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    hasAttachments: searchParams.has("hasAttachments")
      ? searchParams.get("hasAttachments") === "true"
      : undefined,
    category: searchParams.get("category") || undefined,
    isRead: searchParams.has("isRead")
      ? searchParams.get("isRead") === "true"
      : undefined,
    accountId: searchParams.get("accountId") || undefined,
    sortBy:
      (searchParams.get("sortBy") as SearchQueryParams["sortBy"]) || "relevance",
    sortOrder:
      (searchParams.get("sortOrder") as SearchQueryParams["sortOrder"]) || "desc",
    highlight: searchParams.has("highlight")
      ? searchParams.get("highlight") === "true"
      : false,
  };
}

/**
 * GET /api/emails/search
 * Search emails with full-text search and advanced filters
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to search emails" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse query parameters
    const params = parseSearchParams(request.nextUrl.searchParams);

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
        query: {
          searchTerm: params.q,
          filters: {
            sender: params.sender,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            hasAttachments: params.hasAttachments,
            category: params.category,
            isRead: params.isRead,
          },
        },
      } satisfies SearchResponse);
    }

    const accountIds = params.accountId
      ? [params.accountId]
      : emailAccounts.map((a: { id: string }) => a.id);

    // Verify user owns the requested account(s)
    const validAccountIds = accountIds.filter((id: string) =>
      emailAccounts.some((a: { id: string }) => a.id === id)
    );

    if (validAccountIds.length === 0) {
      return NextResponse.json(
        { error: "Forbidden", message: "You don't have access to this account" },
        { status: 403 }
      );
    }

    // Build SQL filters
    const sqlFilters: string[] = [`"accountId" IN (${validAccountIds.map((_: string, i: number) => `$${i + 1}`).join(", ")})`];
    const sqlParams: any[] = [...validAccountIds];
    let paramIndex = validAccountIds.length + 1;

    // Add sender filter
    if (params.sender) {
      sqlFilters.push(`"sender" ILIKE $${paramIndex}`);
      sqlParams.push(`%${params.sender}%`);
      paramIndex++;
    }

    // Add date range filters
    if (params.dateFrom) {
      sqlFilters.push(`"receivedAt" >= $${paramIndex}`);
      sqlParams.push(new Date(params.dateFrom));
      paramIndex++;
    }

    if (params.dateTo) {
      sqlFilters.push(`"receivedAt" <= $${paramIndex}`);
      sqlParams.push(new Date(params.dateTo));
      paramIndex++;
    }

    // Add attachment filter
    if (params.hasAttachments !== undefined) {
      sqlFilters.push(`"hasAttachments" = $${paramIndex}`);
      sqlParams.push(params.hasAttachments);
      paramIndex++;
    }

    // Add category filter
    if (params.category) {
      sqlFilters.push(`"category" = $${paramIndex}`);
      sqlParams.push(params.category);
      paramIndex++;
    }

    // Add read status filter
    if (params.isRead !== undefined) {
      sqlFilters.push(`"isRead" = $${paramIndex}`);
      sqlParams.push(params.isRead);
      paramIndex++;
    }

    const whereClause = sqlFilters.join(" AND ");

    // If full-text search query is provided, use ts_rank for relevance
    if (params.q && params.q.trim()) {
      const searchQuery = params.q.trim().replace(/\s+/g, " & ");

      // Build ORDER BY clause
      let orderByClause = "";
      if (params.sortBy === "relevance") {
        orderByClause = `ts_rank("searchVector", to_tsquery('english', $${paramIndex})) DESC`;
      } else if (params.sortBy === "receivedAt") {
        orderByClause = `"receivedAt" ${params.sortOrder === "asc" ? "ASC" : "DESC"}`;
      } else if (params.sortBy === "sender") {
        orderByClause = `"sender" ${params.sortOrder === "asc" ? "ASC" : "DESC"}`;
      } else if (params.sortBy === "subject") {
        orderByClause = `"subject" ${params.sortOrder === "asc" ? "ASC" : "DESC"}`;
      } else {
        orderByClause = `ts_rank("searchVector", to_tsquery('english', $${paramIndex})) DESC`;
      }

      sqlParams.push(searchQuery);
      paramIndex++;

      // Add full-text search filter
      const fullTextFilter = `"searchVector" @@ to_tsquery('english', $${paramIndex})`;
      sqlParams.push(searchQuery);
      paramIndex++;

      // Get total count
      const countQuery = `
        SELECT COUNT(*)::int as count
        FROM "Email"
        WHERE ${whereClause} AND ${fullTextFilter}
      `;

      const countResult = await prisma.$queryRawUnsafe<[{ count: number }]>(
        countQuery,
        ...sqlParams.slice(0, paramIndex - 1)
      );
      const total = countResult[0]?.count || 0;

      // Build SELECT fields with optional highlighting
      let selectFields = `
        *,
        ts_rank("searchVector", to_tsquery('english', $${paramIndex - 1})) as "relevanceScore"
      `;

      if (params.highlight) {
        const headlineOptions = buildHeadlineOptions(DEFAULT_HIGHLIGHT_CONFIG);
        selectFields += `,
        ts_headline('english', COALESCE("subject", ''), to_tsquery('english', $${paramIndex - 1}), '${headlineOptions}') as "subjectHighlight",
        ts_headline('english', COALESCE("bodyText", ''), to_tsquery('english', $${paramIndex - 1}), '${headlineOptions}') as "bodyHighlight",
        ts_headline('english', COALESCE("sender", ''), to_tsquery('english', $${paramIndex - 1}), '${headlineOptions}') as "senderHighlight"
        `;
      }

      // Fetch emails with relevance score and optional highlights
      const searchQuery2 = `
        SELECT
          ${selectFields}
        FROM "Email"
        WHERE ${whereClause} AND ${fullTextFilter}
        ORDER BY ${orderByClause}
        LIMIT $${paramIndex}
        OFFSET $${paramIndex + 1}
      `;

      sqlParams.push(params.limit);
      sqlParams.push((params.page! - 1) * params.limit!);

      let emails = await prisma.$queryRawUnsafe<SearchResultEmail[]>(
        searchQuery2,
        ...sqlParams
      );

      // Sanitize highlighted results to prevent XSS
      if (params.highlight) {
        emails = emails.map((email: SearchResultEmail) => ({
          ...email,
          subjectHighlight: email.subjectHighlight
            ? sanitizeHighlight(email.subjectHighlight)
            : undefined,
          bodyHighlight: email.bodyHighlight
            ? sanitizeHighlight(email.bodyHighlight)
            : undefined,
          senderHighlight: email.senderHighlight
            ? sanitizeHighlight(email.senderHighlight)
            : undefined,
        }));
      }

      const response: SearchResponse = {
        emails,
        pagination: {
          page: params.page!,
          limit: params.limit!,
          total,
          totalPages: Math.ceil(total / params.limit!),
        },
        query: {
          searchTerm: params.q,
          filters: {
            sender: params.sender,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            hasAttachments: params.hasAttachments,
            category: params.category,
            isRead: params.isRead,
          },
        },
      };

      return NextResponse.json(response);
    }

    // No full-text search - use standard query with filters only
    const orderByClause =
      params.sortBy === "receivedAt"
        ? `"receivedAt" ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
        : params.sortBy === "sender"
        ? `"sender" ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
        : params.sortBy === "subject"
        ? `"subject" ${params.sortOrder === "asc" ? "ASC" : "DESC"}`
        : `"receivedAt" DESC`;

    // Get total count
    const countQuery = `
      SELECT COUNT(*)::int as count
      FROM "Email"
      WHERE ${whereClause}
    `;

    const countResult = await prisma.$queryRawUnsafe<[{ count: number }]>(
      countQuery,
      ...sqlParams
    );
    const total = countResult[0]?.count || 0;

    // Fetch emails
    const emailQuery = `
      SELECT *
      FROM "Email"
      WHERE ${whereClause}
      ORDER BY ${orderByClause}
      LIMIT $${paramIndex}
      OFFSET $${paramIndex + 1}
    `;

    sqlParams.push(params.limit);
    sqlParams.push((params.page! - 1) * params.limit!);

    const emails = await prisma.$queryRawUnsafe<Email[]>(
      emailQuery,
      ...sqlParams
    );

    const response: SearchResponse = {
      emails,
      pagination: {
        page: params.page!,
        limit: params.limit!,
        total,
        totalPages: Math.ceil(total / params.limit!),
      },
      query: {
        searchTerm: params.q,
        filters: {
          sender: params.sender,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          hasAttachments: params.hasAttachments,
          category: params.category,
          isRead: params.isRead,
        },
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
