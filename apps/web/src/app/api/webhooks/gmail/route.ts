/**
 * Gmail Pub/Sub Webhook API Routes
 *
 * Handles push notifications from Gmail via Google Cloud Pub/Sub:
 * - POST /api/webhooks/gmail - Receive Pub/Sub push messages for new emails
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSyncService } from "@/lib/email";
import { verifyPubSubSignature } from "@/lib/notifications/pubsub-auth";

/**
 * Gmail Pub/Sub message structure
 */
interface PubSubMessage {
  message: {
    /** Base64-encoded message data */
    data: string;
    /** Unique message ID from Pub/Sub */
    messageId?: string;
    /** When the message was published */
    publishTime?: string;
  };
  /** Subscription that received the message */
  subscription?: string;
}

/**
 * Decoded Gmail notification data
 */
interface GmailNotificationData {
  /** Email address that received new mail */
  emailAddress: string;
  /** History ID to use for incremental sync */
  historyId: string;
}

/**
 * POST /api/webhooks/gmail
 * Receives push notifications from Gmail via Pub/Sub
 *
 * Gmail sends notifications when new mail arrives in watched mailboxes.
 * This endpoint:
 * 1. Validates and decodes the Pub/Sub message
 * 2. Logs the webhook for debugging
 * 3. Triggers incremental email sync
 * 4. Returns 200 OK quickly (Pub/Sub expects fast responses)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let webhookLogId: string | undefined;

  try {
    // SECURITY: Verify request is from Google Cloud Pub/Sub
    const authorizationHeader = request.headers.get('authorization');

    if (!await verifyPubSubSignature(authorizationHeader)) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Invalid Pub/Sub signature"
        },
        { status: 403 }
      );
    }

    // Parse request body
    let body: PubSubMessage;
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

    // Validate Pub/Sub message structure
    if (!body.message || !body.message.data) {
      return NextResponse.json(
        { error: "Bad Request", message: "Missing message.data field" },
        { status: 400 }
      );
    }

    // Log webhook request for debugging
    const webhookLog = await prisma.webhookLog.create({
      data: {
        endpoint: "/api/webhooks/gmail",
        method: "POST",
        payload: rawBody,
        headers: JSON.stringify(Object.fromEntries(request.headers.entries())),
        statusCode: null,
        response: null,
      },
    });
    webhookLogId = webhookLog.id;

    // Decode base64 message data
    let notificationData: GmailNotificationData;
    try {
      const decodedData = Buffer.from(body.message.data, "base64").toString("utf-8");
      notificationData = JSON.parse(decodedData);
    } catch {
      if (webhookLogId) {
        await updateWebhookLog(webhookLogId, 400, "Failed to decode message data");
      }
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid base64 or JSON in message.data" },
        { status: 400 }
      );
    }

    // Validate notification data
    if (!notificationData.emailAddress || !notificationData.historyId) {
      if (webhookLogId) {
        await updateWebhookLog(webhookLogId, 400, "Invalid notification data structure");
      }
      return NextResponse.json(
        { error: "Bad Request", message: "Missing emailAddress or historyId" },
        { status: 400 }
      );
    }

    // Find the email account for this notification
    const emailAccount = await prisma.emailAccount.findFirst({
      where: {
        email: notificationData.emailAddress,
        provider: "google",
      },
    });

    if (!emailAccount) {
      if (webhookLogId) {
        await updateWebhookLog(
          webhookLogId,
          200,
          `No account found for ${notificationData.emailAddress}`
        );
      }
      return NextResponse.json({
        success: true,
        message: "No account found for this email address",
      });
    }

    // Trigger incremental sync asynchronously (don't wait for completion)
    // Pub/Sub expects quick 200 OK response, so we process sync in background
    triggerIncrementalSync(emailAccount.id, notificationData.historyId)
      .then(async (result) => {
        await updateWebhookLog(
          webhookLogId!,
          200,
          `Sync completed: ${result.newEmails} new, ${result.updatedEmails} updated`
        );
      })
      .catch(async (error) => {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        await updateWebhookLog(webhookLogId!, 500, `Sync failed: ${errorMessage}`);
      });

    // Return success immediately
    return NextResponse.json({
      success: true,
      message: "Notification received, sync triggered",
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
async function triggerIncrementalSync(accountId: string, _historyId: string) {
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
