import { NextResponse } from "next/server";
import { unifiedAuth } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";
import { cacheInvalidate, cacheKeys } from "@/lib/cache";

export async function POST() {
  const session = await unifiedAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  await cacheInvalidate(cacheKeys.notificationsCount(session.user.id));

  return NextResponse.json({ success: true });
}
