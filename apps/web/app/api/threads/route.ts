import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const mailboxId = searchParams.get("mailboxId");
  const status = searchParams.get("status") || "open";

  // Get mailbox IDs the user has access to
  const accessibleMailboxes = await prisma.mailboxAccess.findMany({
    where: { userId: session.user.id },
    select: { mailboxId: true },
  });
  const accessibleMailboxIds = accessibleMailboxes.map((a) => a.mailboxId);

  // Build where clause
  const where: Record<string, unknown> = {
    mailboxId: mailboxId
      ? { in: accessibleMailboxIds.includes(mailboxId) ? [mailboxId] : [] }
      : { in: accessibleMailboxIds },
    status,
  };

  const threads = await prisma.thread.findMany({
    where,
    orderBy: { lastActivityAt: "desc" },
    take: 50,
    include: {
      emails: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          id: true,
          fromAddress: true,
          fromName: true,
          bodyText: true,
          date: true,
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
              color: true,
            },
          },
        },
      },
      assignments: {
        where: { status: { not: "done" } },
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      seenBy: {
        where: { userId: session.user.id },
        select: { userId: true },
      },
      _count: {
        select: { emails: true },
      },
    },
  });

  return NextResponse.json(threads);
}
