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
  const status = searchParams.get("status");
  const tagId = searchParams.get("tagId");
  const tagIds = searchParams.get("tagIds");
  const query = searchParams.get("q")?.trim();

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
  };

  // Status filtering:
  // - status=all or tag filter with no explicit status -> show all statuses
  // - status=open/archived/snoozed -> filter by that status
  // - no status param and no tag filter -> default to "open" (inbox behavior)
  if (status && status !== "all") {
    where.status = status;
  } else if (!status && !tagId && !tagIds) {
    where.status = "open";
  }

  // Filter by tag(s) if specified
  if (tagIds) {
    const ids = tagIds.split(",").filter(Boolean);
    if (ids.length > 0) {
      where.tags = { some: { tagId: { in: ids } } };
    }
  } else if (tagId) {
    where.tags = { some: { tagId } };
  }

  // Full-text search via ILIKE on email fields
  if (query && query.length >= 2) {
    where.emails = {
      some: {
        OR: [
          { subject: { contains: query, mode: "insensitive" } },
          { bodyText: { contains: query, mode: "insensitive" } },
          { fromName: { contains: query, mode: "insensitive" } },
          { fromAddress: { contains: query, mode: "insensitive" } },
        ],
      },
    };
  }

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
