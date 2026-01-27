/**
 * Recent Searches API Routes
 *
 * Handles recent search history:
 * - GET /api/emails/search/recent - Get recent searches for the current user
 * - POST /api/emails/search/recent - Save a new search to history
 * - DELETE /api/emails/search/recent - Clear search history
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Search history entry
 */
interface SearchHistoryEntry {
  id: string;
  query: string;
  filters?: {
    sender?: string;
    dateFrom?: string;
    dateTo?: string;
    hasAttachments?: boolean;
    category?: string;
    isRead?: boolean;
  };
  createdAt: Date;
}

/**
 * Response structure for recent searches
 */
interface RecentSearchesResponse {
  searches: SearchHistoryEntry[];
  total: number;
}

/**
 * Request body for saving a search
 */
interface SaveSearchRequest {
  query: string;
  filters?: {
    sender?: string;
    dateFrom?: string;
    dateTo?: string;
    hasAttachments?: boolean;
    category?: string;
    isRead?: boolean;
  };
}

/**
 * GET /api/emails/search/recent
 * Retrieve recent searches for the current user (limit 10)
 */
export async function GET(): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to access search history" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Fetch recent searches (limit to 10 most recent)
    const searches = await prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        query: true,
        filters: true,
        createdAt: true,
      },
    });

    const response: RecentSearchesResponse = {
      searches: searches.map((search: {
        id: string;
        query: string;
        filters: unknown;
        createdAt: Date;
      }) => ({
        id: search.id,
        query: search.query,
        filters: search.filters as SearchHistoryEntry["filters"],
        createdAt: search.createdAt,
      })),
      total: searches.length,
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
 * POST /api/emails/search/recent
 * Save a new search to history
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to save search history" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body: SaveSearchRequest = await request.json();

    if (!body.query || typeof body.query !== "string") {
      return NextResponse.json(
        { error: "Bad Request", message: "Query is required and must be a string" },
        { status: 400 }
      );
    }

    // Check if this exact search already exists (to avoid duplicates)
    const existingSearch = await prisma.searchHistory.findFirst({
      where: {
        userId,
        query: body.query,
        filters: body.filters ? (body.filters as any) : null,
      },
    });

    if (existingSearch) {
      // Update the timestamp of the existing search to move it to the top
      const updatedSearch = await prisma.searchHistory.update({
        where: { id: existingSearch.id },
        data: { createdAt: new Date() },
        select: {
          id: true,
          query: true,
          filters: true,
          createdAt: true,
        },
      });

      return NextResponse.json({
        search: {
          id: updatedSearch.id,
          query: updatedSearch.query,
          filters: updatedSearch.filters as SearchHistoryEntry["filters"],
          createdAt: updatedSearch.createdAt,
        },
      });
    }

    // Create new search history entry
    const search = await prisma.searchHistory.create({
      data: {
        userId,
        query: body.query,
        filters: body.filters ? (body.filters as any) : null,
      },
      select: {
        id: true,
        query: true,
        filters: true,
        createdAt: true,
      },
    });

    // Maintain limit of 10 recent searches per user
    const allSearches = await prisma.searchHistory.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });

    if (allSearches.length > 10) {
      // Delete the oldest searches beyond the 10 most recent
      const searchesToDelete = allSearches.slice(10);
      await prisma.searchHistory.deleteMany({
        where: {
          id: { in: searchesToDelete.map((s: { id: string }) => s.id) },
        },
      });
    }

    return NextResponse.json(
      {
        search: {
          id: search.id,
          query: search.query,
          filters: search.filters as SearchHistoryEntry["filters"],
          createdAt: search.createdAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/emails/search/recent
 * Clear all search history for the current user
 */
export async function DELETE(): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in to clear search history" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Delete all search history for this user
    await prisma.searchHistory.deleteMany({
      where: { userId },
    });

    return NextResponse.json(
      { message: "Search history cleared successfully" },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}
