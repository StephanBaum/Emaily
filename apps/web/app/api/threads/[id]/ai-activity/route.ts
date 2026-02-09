import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;

  // Verify access to thread
  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      mailbox: {
        access: {
          some: { userId: session.user.id },
        },
      },
    },
    select: { id: true },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Fetch AI activity logs for this thread
  const activities = await prisma.activityLog.findMany({
    where: {
      targetId: threadId,
      action: { startsWith: "ai_" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(activities);
}
