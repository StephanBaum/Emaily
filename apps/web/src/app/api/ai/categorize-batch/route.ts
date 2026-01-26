/**
 * Batch AI Email Categorization API Route
 *
 * Handles batch categorization of uncategorized emails:
 * - POST /api/ai/categorize-batch - Categorize uncategorized emails
 * - GET /api/ai/categorize-batch - Get categorization status/stats
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  categorizeUncategorizedEmails,
  getUncategorizedEmails,
} from "@/lib/email";

/**
 * Request body for batch categorization
 */
interface BatchCategorizeRequest {
  /** Specific account ID to categorize (optional - categorizes all if not provided) */
  accountId?: string;
  /** Maximum emails to categorize (default 50, max 100) */
  limit?: number;
  /** Delay between AI calls in ms (default 200) */
  delay?: number;
}

/**
 * GET /api/ai/categorize-batch
 * Get stats about uncategorized emails
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Get user's email accounts
    const accounts = await prisma.emailAccount.findMany({
      where: { userId },
      select: { id: true, provider: true },
    });

    if (accounts.length === 0) {
      return NextResponse.json({
        totalUncategorized: 0,
        accounts: [],
      });
    }

    const accountIds = accounts.map((a) => a.id);

    // Count uncategorized emails per account
    const accountStats = await Promise.all(
      accounts.map(async (account) => {
        const uncategorizedCount = await prisma.email.count({
          where: {
            accountId: account.id,
            category: null,
          },
        });

        const totalCount = await prisma.email.count({
          where: { accountId: account.id },
        });

        const categorizedCount = await prisma.email.count({
          where: {
            accountId: account.id,
            category: { not: null },
          },
        });

        // Get category distribution
        const categoryDistribution = await prisma.email.groupBy({
          by: ["category"],
          where: {
            accountId: account.id,
            category: { not: null },
          },
          _count: { category: true },
        });

        return {
          accountId: account.id,
          provider: account.provider,
          totalEmails: totalCount,
          categorizedEmails: categorizedCount,
          uncategorizedEmails: uncategorizedCount,
          categoryDistribution: categoryDistribution.reduce(
            (acc, item) => {
              acc[item.category || "unknown"] = item._count.category;
              return acc;
            },
            {} as Record<string, number>
          ),
        };
      })
    );

    const totalUncategorized = accountStats.reduce(
      (sum, stat) => sum + stat.uncategorizedEmails,
      0
    );

    return NextResponse.json({
      totalUncategorized,
      accounts: accountStats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Internal Server Error", message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/categorize-batch
 * Categorize uncategorized emails using AI
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Authenticate user
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized", message: "You must be signed in" },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    let body: BatchCategorizeRequest = {};
    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const { accountId, limit = 50, delay = 200 } = body;

    // Validate limit
    if (typeof limit !== "number" || limit < 1 || limit > 100) {
      return NextResponse.json(
        { error: "Bad Request", message: "limit must be between 1 and 100" },
        { status: 400 }
      );
    }

    // Get user's email accounts
    const accounts = await prisma.emailAccount.findMany({
      where: accountId
        ? { id: accountId, userId }
        : { userId },
      select: { id: true },
    });

    if (accounts.length === 0) {
      if (accountId) {
        return NextResponse.json(
          { error: "Not Found", message: "Email account not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Not Found", message: "No email accounts connected" },
        { status: 404 }
      );
    }

    const accountIds = accounts.map((a) => a.id);

    // Get uncategorized emails
    const uncategorizedEmails = await prisma.email.findMany({
      where: {
        accountId: { in: accountIds },
        category: null,
      },
      orderBy: { receivedAt: "desc" },
      take: limit,
      select: {
        id: true,
        subject: true,
        body: true,
        sender: true,
        recipients: true,
      },
    });

    if (uncategorizedEmails.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No uncategorized emails found",
        total: 0,
        categorized: 0,
        failed: 0,
        results: [],
      });
    }

    // Perform batch categorization
    const result = await categorizeUncategorizedEmails(
      prisma,
      accountId,
      {
        batchSize: limit,
        delayBetweenCalls: delay,
      }
    );

    return NextResponse.json({
      success: result.failed < result.total,
      message: `Categorized ${result.categorized} of ${result.total} emails`,
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
