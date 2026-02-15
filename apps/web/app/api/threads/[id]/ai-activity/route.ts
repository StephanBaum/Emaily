import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyThreadAccess } from "@/lib/api-helpers";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId } = await params;

  const { error: accessError } = await verifyThreadAccess(session.user.id, threadId);
  if (accessError) return accessError;

  // Fetch AI activity logs for this thread
  const activities = await prisma.activityLog.findMany({
    where: {
      targetId: threadId,
      action: { startsWith: "ai_" },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Response.json(activities);
}
