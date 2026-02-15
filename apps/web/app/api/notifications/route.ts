import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cacheOrFetch, cacheKeys, CACHE_TTL } from "@/lib/cache";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);
  const cursor = searchParams.get("cursor");

  // Notifications list is cursor-paginated, not cached
  const notifications = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
  });

  const hasMore = notifications.length > limit;
  if (hasMore) notifications.pop();

  // Cache unread count (polled frequently, simple aggregate)
  const unreadCount = await cacheOrFetch(
    cacheKeys.notificationsCount(userId),
    CACHE_TTL.notificationsCount,
    () => prisma.notification.count({
      where: { userId, read: false },
    })
  );

  return NextResponse.json({
    notifications,
    unreadCount,
    hasMore,
    nextCursor: hasMore ? notifications[notifications.length - 1]?.id : null,
  });
}
