import { NextRequest, NextResponse } from "next/server";
import { unifiedAuth } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";
import { cacheInvalidate, cacheKeys } from "@/lib/cache";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await unifiedAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { read: true },
  });

  await cacheInvalidate(cacheKeys.notificationsCount(session.user.id));

  return NextResponse.json({ success: true });
}
