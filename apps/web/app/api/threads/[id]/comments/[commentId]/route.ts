import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, apiError, apiSuccess } from "@/lib/api-helpers";
import { onThreadMutated } from "@/lib/thread-cache";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId, commentId } = await params;
  const body = await request.json();
  const { content } = body;

  if (!content?.trim()) {
    return apiError("Comment content is required", 400);
  }

  // Verify access to thread and ownership of comment
  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      threadId,
      thread: {
        mailbox: {
          access: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    },
  });

  if (!comment) {
    return apiError("Comment not found", 404);
  }

  // Only allow editing own comments
  if (comment.userId !== session.user.id) {
    return apiError("Can only edit your own comments", 403);
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content: content.trim() },
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

  return Response.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId, commentId } = await params;

  // Verify access to thread and ownership of comment
  const comment = await prisma.comment.findFirst({
    where: {
      id: commentId,
      threadId,
      thread: {
        mailbox: {
          access: {
            some: {
              userId: session.user.id,
            },
          },
        },
      },
    },
  });

  if (!comment) {
    return apiError("Comment not found", 404);
  }

  // Only allow deleting own comments (or admin could delete any - check role)
  if (comment.userId !== session.user.id && session.user.role !== "admin") {
    return apiError("Can only delete your own comments", 403);
  }

  await prisma.comment.delete({
    where: { id: commentId },
  });

  await onThreadMutated(threadId);

  return apiSuccess();
}
