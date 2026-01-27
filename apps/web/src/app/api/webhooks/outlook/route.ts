/**
 * Outlook Graph Webhook API Routes
 *
 * Handles push notifications from Outlook via Microsoft Graph subscriptions:
 * - GET /api/webhooks/outlook - Validate subscription (returns validationToken)
 * - POST /api/webhooks/outlook - Receive Graph change notifications for new emails
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSyncService } from "@/lib/email";

/**
 * Outlook Graph notification structure
 */
interface OutlookNotification {
  /** Subscription ID that triggered this notification */
  subscriptionId: string;
  /** When the subscription expires */
  subscriptionExpirationDateTime: string;
  /** Type of change (created, updated, deleted) */
  changeType: string;
  /** Resource path (e.g., "Users/{userId}/Messages/{messageId}") */
  resource: string;
  /** Resource data containing message details */
  resourceData?: {
    "@odata.type": string;
    "@odata.id": string;
    id: string;
  };
}

/**
 * Outlook webhook request body structure
 */
interface OutlookWebhookBody {
  /** Array of change notifications */
  value: OutlookNotification[];
  /** Optional validation token for subscription setup */
  validationToken?: string;
}

/**
 * GET /api/webhooks/outlook
 * Validates Microsoft Graph subscription during setup
 *
 * When creating a subscription, Microsoft Graph sends a validation request
 * with a validationToken query parameter. We must return this token in
 * plain text with 200 OK to confirm the webhook endpoint.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Get validation token from query parameters
    const { searchParams } = new URL(request.url);
    const validationToken = searchParams.get("validationToken");

    if (!validationToken) {
      return NextResponse.json(
        { error: "Bad Request", message: "Missing validationToken parameter" },
        { status: 400 }
      );
    }

    // Log validation request for debugging
    await prisma.webhookLog.create({
      data: {
        endpoint: "/api/webhooks/outlook",
        method: "GET",
        payload: JSON.stringify({ validationToken }),
        headers: JSON.stringify(Object.fromEntries(request.headers.entries())),
        statusCode: 200,
        response: validationToken,
      },
    });

    // Return validation token as plain text
    return new NextResponse(validationToken, {
      status: 200,
      headers: {
        "Content-Type": "text/plain",
      },
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
 * POST /api/webhooks/outlook
 * Receives push notifications from Outlook via Microsoft Graph
 *
 * Outlook sends notifications when changes occur in watched mailboxes.
 * This endpoint:
 * 1. Validates and parses the notification body
 * 2. Logs the webhook for debugging
 * 3. Triggers incremental email sync for each notification
 * 4. Returns 200 OK quickly (Graph expects fast responses)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let webhookLogId: string | undefined;

  try {
    // Parse request body
    let body: OutlookWebhookBody;
    let rawBody: string;
    try {
      rawBody = await request.text();
      if (!rawBody) {
        return NextResponse.json(
          { error: "Bad Request", message: "Empty request body" },
          { status: 400 }
        );
      }
      body = JSON.parse(rawBody);
    } catch {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    // Validate notification structure
    if (!body.value || !Array.isArray(body.value)) {
      return NextResponse.json(
        { error: "Bad Request", message: "Missing or invalid value array" },
        { status: 400 }
      );
    }

    // Log webhook request for debugging
    const webhookLog = await prisma.webhookLog.create({
      data: {
        endpoint: "/api/webhooks/outlook",
        method: "POST",
        payload: rawBody,
        headers: JSON.stringify(Object.fromEntries(request.headers.entries())),
        statusCode: null,
        response: null,
      },
    });
    webhookLogId = webhookLog.id;

    // Process each notification in the batch
    const notifications = body.value;

    if (notifications.length === 0) {
      if (webhookLogId) {
        await updateWebhookLog(webhookLogId, 200, "No notifications to process");
      }
      return NextResponse.json({
        success: true,
        message: "No notifications received",
      });
    }

    // Extract unique subscription IDs from notifications
    const subscriptionIds = [...new Set(notifications.map((n) => n.subscriptionId))];

    // Find email accounts associated with these subscriptions
    // Note: In production, you'd store subscriptionId in EmailAccount or a separate table
    // For now, we'll trigger sync for all Outlook accounts
    const emailAccounts = await prisma.emailAccount.findMany({
      where: {
        provider: "microsoft",
      },
    });

    if (emailAccounts.length === 0) {
      if (webhookLogId) {
        await updateWebhookLog(
          webhookLogId,
          200,
          `No Outlook accounts found for subscriptions: ${subscriptionIds.join(", ")}`
        );
      }
      return NextResponse.json({
        success: true,
        message: "No accounts found for these subscriptions",
      });
    }

    // Trigger incremental sync for each account asynchronously
    // Graph expects quick 200 OK response, so we process syncs in background
    const syncPromises = emailAccounts.map((account: { id: string; provider: string; accessToken: string; refreshToken: string }) =>
      triggerIncrementalSync(account.id, notifications)
        .then((result) => ({
          accountId: account.id,
          success: true,
          newEmails: result.newEmails,
          updatedEmails: result.updatedEmails,
        }))
        .catch((error) => ({
          accountId: account.id,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }))
    );

    // Wait for all syncs to complete and update log
    Promise.all(syncPromises)
      .then(async (results) => {
        const successCount = results.filter((r: { success: boolean }) => r.success).length;
        const failCount = results.filter((r: { success: boolean }) => !r.success).length;
        const totalNew = results.reduce((sum: number, r: { newEmails?: number }) => sum + (r.newEmails || 0), 0);
        const totalUpdated = results.reduce((sum: number, r: { updatedEmails?: number }) => sum + (r.updatedEmails || 0), 0);

        await updateWebhookLog(
          webhookLogId!,
          200,
          `Processed ${notifications.length} notifications for ${emailAccounts.length} accounts: ${successCount} succeeded, ${failCount} failed. Total: ${totalNew} new, ${totalUpdated} updated`
        );
      })
      .catch(async (error) => {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await updateWebhookLog(webhookLogId!, 500, `Sync processing failed: ${errorMessage}`);
      });

    // Return success immediately
    return NextResponse.json({
      success: true,
      message: `Received ${notifications.length} notifications, sync triggered for ${emailAccounts.length} accounts`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update webhook log with error
    if (webhookLogId) {
      await updateWebhookLog(webhookLogId, 500, errorMessage);
    }

    return NextResponse.json(
      { error: "Internal Server Error", message: errorMessage },
      { status: 500 }
    );
  }
}

/**
 * Trigger incremental email sync for an account
 * Runs asynchronously without blocking the webhook response
 */
async function triggerIncrementalSync(accountId: string, _notifications: OutlookNotification[]) {
  // Get account with tokens
  const account = await prisma.emailAccount.findUnique({
    where: { id: accountId },
  });

  if (!account) {
    throw new Error("Account not found");
  }

  // Create sync service
  const syncService = createSyncService(prisma, {
    id: account.id,
    provider: account.provider,
    accessToken: account.accessToken,
    refreshToken: account.refreshToken,
    userId: account.userId,
  });

  // Perform incremental sync
  const result = await syncService.incrementalSync({ maxEmails: 100 });

  // Update account's updatedAt timestamp
  await prisma.emailAccount.update({
    where: { id: account.id },
    data: { updatedAt: new Date() },
  });

  return result;
}

/**
 * Update webhook log with response details
 */
async function updateWebhookLog(
  webhookLogId: string,
  statusCode: number,
  response: string
) {
  try {
    await prisma.webhookLog.update({
      where: { id: webhookLogId },
      data: {
        statusCode,
        response,
      },
    });
  } catch {
    // Silently fail if webhook log update fails
    // Don't want to affect the main webhook processing
  }
}
