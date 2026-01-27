/**
 * Email Sync API Routes
 *
 * Handles email synchronization with external providers:
 * - POST /api/emails/sync - Trigger sync for user's email accounts
 * - GET /api/emails/sync - Get sync status/statistics
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import {
  createSyncService,
  syncAllUserAccounts as _syncAllUserAccounts,
  syncJobQueue,
  type SyncResult,
  categorizeUncategorizedEmails,
  type BatchCategorizationResult,
} from "@/lib/email";

/**
 * Sync request body structure
 */
interface SyncRequest {
  /** Specific account ID to sync (optional - syncs all if not provided) */
  accountId?: string;
  /** Type of sync to perform */
  syncType?: "full" | "incremental";
  /** Maximum emails to sync (for full sync) */
  maxEmails?: number;
  /** Whether to run AI categorization on new emails after sync */
  categorize?: boolean;
  /** Maximum emails to categorize (default 50, max 100) */
  categorizeLimit?: number;
}

/**
 * Sync response structure
 */
interface SyncResponse {
  success: boolean;
  message: string;
  results?: {
    accountId: string;
    provider: string;
    newEmails: number;
    updatedEmails: number;
    totalProcessed: number;
    errors: Array<{ messageId?: string; error: string }>;
    syncedAt: string;
  }[];
  /** AI categorization results (if categorize=true) */
  categorization?: {
    total: number;
    categorized: number;
    failed: number;
  };
}

/**
 * GET /api/emails/sync
 * Get sync status and statistics for user's accounts
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
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

    // Check rate limit
    const rateLimitResult = await rateLimit(userId, "/api/emails/sync", RATE_LIMITS.SYNC);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000))
          }
        }
      );
    }

    // Get user's email accounts with email counts
    const accounts = await prisma.emailAccount.findMany({
      where: { userId },
      select: {
        id: true,
        provider: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { emails: true },
        },
      },
    });

    // Get email statistics for each account
    const accountStats = await Promise.all(
      accounts.map(async (account) => {
        // Get basic counts
        const [totalCount, unreadCount, starredCount, latestEmail] = await Promise.all([
          prisma.email.count({ where: { accountId: account.id } }),
          prisma.email.count({ where: { accountId: account.id, isRead: false } }),
          prisma.email.count({ where: { accountId: account.id, isStarred: true } }),
          prisma.email.findFirst({
            where: { accountId: account.id },
            orderBy: { receivedAt: "desc" },
            select: { receivedAt: true },
          }),
        ]);

        // Get category distribution
        const categoryDistribution = await prisma.email.groupBy({
          by: ["category"],
          where: { accountId: account.id },
          _count: { category: true },
        });

        // Get pending sync jobs for this account
        const pendingJobs = syncJobQueue.getJobsForAccount(account.id).filter(
          (job) => job.status === "pending" || job.status === "running"
        );

        return {
          accountId: account.id,
          provider: account.provider,
          connectedAt: account.createdAt.toISOString(),
          lastSyncedAt: account.updatedAt.toISOString(),
          statistics: {
            totalEmails: totalCount,
            unreadEmails: unreadCount,
            starredEmails: starredCount,
            latestEmailDate: latestEmail?.receivedAt?.toISOString() || null,
            categoryDistribution: categoryDistribution.reduce(
              (acc, item) => {
                acc[item.category || "uncategorized"] = item._count.category;
                return acc;
              },
              {} as Record<string, number>
            ),
          },
          syncStatus: {
            hasPendingJobs: pendingJobs.length > 0,
            pendingJobCount: pendingJobs.length,
          },
        };
      })
    );

    return NextResponse.json({
      accounts: accountStats,
      totalAccounts: accounts.length,
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
 * POST /api/emails/sync
 * Trigger email synchronization for user's accounts
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

    // Check rate limit
    const rateLimitResult = await rateLimit(userId, "/api/emails/sync", RATE_LIMITS.SYNC);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rateLimitResult.reset.getTime() - Date.now()) / 1000))
          }
        }
      );
    }

    // Parse request body
    let body: SyncRequest = {};
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

    const { accountId, syncType = "incremental", maxEmails = 100, categorize = false, categorizeLimit = 50 } = body;

    // Validate syncType
    if (!["full", "incremental"].includes(syncType)) {
      return NextResponse.json(
        { error: "Bad Request", message: "syncType must be 'full' or 'incremental'" },
        { status: 400 }
      );
    }

    // Validate maxEmails
    if (typeof maxEmails !== "number" || maxEmails < 1 || maxEmails > 1000) {
      return NextResponse.json(
        { error: "Bad Request", message: "maxEmails must be between 1 and 1000" },
        { status: 400 }
      );
    }

    // Get user's email accounts
    const accounts = await prisma.emailAccount.findMany({
      where: accountId
        ? { id: accountId, userId }
        : { userId },
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

    // Perform sync for each account
    const results: SyncResponse["results"] = [];
    const errors: string[] = [];

    for (const account of accounts) {
      try {
        // Create sync service for this account
        const syncService = createSyncService(prisma, {
          id: account.id,
          provider: account.provider,
          accessToken: account.accessToken,
          refreshToken: account.refreshToken,
        });

        // Perform the sync
        let syncResult: SyncResult;
        if (syncType === "full") {
          syncResult = await syncService.fullSync({ maxEmails });
        } else {
          syncResult = await syncService.incrementalSync({ maxEmails });
        }

        // Update account's updatedAt timestamp
        await prisma.emailAccount.update({
          where: { id: account.id },
          data: { updatedAt: new Date() },
        });

        results.push({
          accountId: account.id,
          provider: account.provider,
          newEmails: syncResult.newEmails,
          updatedEmails: syncResult.updatedEmails,
          totalProcessed: syncResult.totalProcessed,
          errors: syncResult.errors,
          syncedAt: syncResult.syncedAt.toISOString(),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Account ${account.id}: ${errorMessage}`);

        results.push({
          accountId: account.id,
          provider: account.provider,
          newEmails: 0,
          updatedEmails: 0,
          totalProcessed: 0,
          errors: [{ error: errorMessage }],
          syncedAt: new Date().toISOString(),
        });
      }
    }

    const allSuccessful = errors.length === 0;
    const totalNewEmails = results.reduce((sum, r) => sum + r.newEmails, 0);
    const totalProcessed = results.reduce((sum, r) => sum + r.totalProcessed, 0);

    // Optionally run AI categorization on new/uncategorized emails
    let categorizationResult: BatchCategorizationResult | undefined;
    if (categorize && totalNewEmails > 0) {
      try {
        categorizationResult = await categorizeUncategorizedEmails(
          prisma,
          accountId,
          {
            batchSize: Math.min(categorizeLimit, 100),
            delayBetweenCalls: 200,
          }
        );
      } catch (catError) {
        // Log categorization errors but don't fail the sync
        const catErrorMsg = catError instanceof Error ? catError.message : "Unknown error";
        errors.push(`AI categorization: ${catErrorMsg}`);
      }
    }

    const response: SyncResponse = {
      success: allSuccessful,
      message: allSuccessful
        ? `Sync completed: ${totalNewEmails} new emails, ${totalProcessed} total processed${
            categorizationResult ? `, ${categorizationResult.categorized} categorized` : ""
          }`
        : `Sync completed with errors: ${errors.join("; ")}`,
      results,
      categorization: categorizationResult
        ? {
            total: categorizationResult.total,
            categorized: categorizationResult.categorized,
            failed: categorizationResult.failed,
          }
        : undefined,
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
