import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { checkImapQueueHealth } from "@emaily/mail-engine";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get queue health
  const queueHealth = await checkImapQueueHealth();

  // Get recent failed operations for user's mailboxes
  const failedOps = await prisma.imapOperation.findMany({
    where: {
      status: "failed",
      mailboxId: {
        in: await prisma.mailbox
          .findMany({
            where: {
              access: { some: { userId: session.user.id } },
            },
            select: { id: true },
          })
          .then((mailboxes) => mailboxes.map((m) => m.id)),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      operation: true,
      error: true,
      createdAt: true,
      processedAt: true,
    },
  });

  // Get pending operations count
  const pendingCount = await prisma.imapOperation.count({
    where: {
      status: "pending",
      mailboxId: {
        in: await prisma.mailbox
          .findMany({
            where: {
              access: { some: { userId: session.user.id } },
            },
            select: { id: true },
          })
          .then((mailboxes) => mailboxes.map((m) => m.id)),
      },
    },
  });

  return NextResponse.json({
    queue: queueHealth,
    pendingOperations: pendingCount,
    recentFailures: failedOps,
    hasFailures: failedOps.length > 0,
  });
}
