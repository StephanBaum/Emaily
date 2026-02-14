import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TRUST_LEVEL_ORDER, type TrustLevel } from "@emailautomation/shared";

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
  const filter = searchParams.get("filter"); // "unprocessed" = threads AI hasn't touched

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

  // Unprocessed filter: threads AI hasn't touched (no AI-applied tags + status=open)
  // This takes precedence over status filtering
  if (filter === "unprocessed") {
    where.status = "open";
    where.tags = { none: { appliedBy: "ai" } };
  } else {
    // Status filtering:
    // - status=quarantined -> show quarantined OR spam-tagged threads
    // - status=all or tag filter with no explicit status -> show all statuses
    // - status=open/archived/snoozed -> filter by that status
    // - no status param and no tag filter -> default to "open" (inbox behavior)
    if (status === "quarantined") {
      // Spam category: quarantined threads OR threads tagged "Spam"
      where.OR = [
        { status: "quarantined" },
        { tags: { some: { tag: { name: { equals: "Spam", mode: "insensitive" } } } } },
      ];
    } else if (status && status !== "all") {
      where.status = status;
    } else if (!status && !tagId && !tagIds) {
      where.status = "open";
    }
  }

  // Filter by tag(s) if specified (skip if using unprocessed filter)
  if (filter !== "unprocessed") {
    if (tagIds) {
      const ids = tagIds.split(",").filter(Boolean);
      if (ids.length > 0) {
        where.tags = { some: { tagId: { in: ids } } };
      }
    } else if (tagId) {
      where.tags = { some: { tagId } };
    }
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
        select: { userId: true, lastSeenEmailId: true, seenAt: true },
      },
      _count: {
        select: { emails: true },
      },
    },
  });

  // When using unprocessed filter, sort by trust level (VIP > trusted > known > stranger)
  // then by lastActivityAt within each trust level
  if (filter === "unprocessed") {
    threads.sort((a, b) => {
      const trustA = TRUST_LEVEL_ORDER[(a.senderTrustLevel as TrustLevel) || "stranger"];
      const trustB = TRUST_LEVEL_ORDER[(b.senderTrustLevel as TrustLevel) || "stranger"];
      if (trustA !== trustB) {
        return trustB - trustA; // Higher trust first
      }
      // Secondary sort by lastActivityAt desc
      return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
    });
  }

  return NextResponse.json(threads, {
    headers: {
      // Very short cache for real-time thread list
      "Cache-Control": "private, max-age=5, stale-while-revalidate=30",
    },
  });
}
