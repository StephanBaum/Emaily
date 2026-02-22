import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cacheOrFetch, cacheKeys, CACHE_TTL } from "@/lib/cache";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const unreadCount = await cacheOrFetch(
    cacheKeys.notificationsCount(session.user.id),
    CACHE_TTL.notificationsCount,
    () => prisma.notification.count({
      where: { userId: session.user.id, read: false },
    })
  );

  return NextResponse.json({ unreadCount });
}
