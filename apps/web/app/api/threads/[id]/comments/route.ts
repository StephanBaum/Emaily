import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyThreadAccess, apiError } from "@/lib/api-helpers";
import { onThreadMutated } from "@/lib/thread-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId } = await params;

  const { error: accessError } = await verifyThreadAccess(session.user.id, threadId);
  if (accessError) return accessError;

  const comments = await prisma.comment.findMany({
    where: { threadId },
    orderBy: { createdAt: "asc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return Response.json(comments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId } = await params;
  const body = await request.json();
  const { content } = body;

  if (!content?.trim()) {
    return apiError("Comment content is required", 400);
  }

  const { error: accessError } = await verifyThreadAccess(session.user.id, threadId);
  if (accessError) return accessError;

  const comment = await prisma.comment.create({
    data: {
      threadId,
      userId: session.user.id,
      content: content.trim(),
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  await onThreadMutated(threadId);

  return Response.json(comment, { status: 201 });
}
