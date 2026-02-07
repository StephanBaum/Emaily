import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId, commentId } = await params;
  const body = await request.json();
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json(
      { error: "Comment content is required" },
      { status: 400 }
    );
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
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Only allow editing own comments
  if (comment.userId !== session.user.id) {
    return NextResponse.json(
      { error: "Can only edit your own comments" },
      { status: 403 }
    );
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

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    return NextResponse.json({ error: "Comment not found" }, { status: 404 });
  }

  // Only allow deleting own comments (or admin could delete any - check role)
  if (comment.userId !== session.user.id && session.user.role !== "admin") {
    return NextResponse.json(
      { error: "Can only delete your own comments" },
      { status: 403 }
    );
  }

  await prisma.comment.delete({
    where: { id: commentId },
  });

  return NextResponse.json({ success: true });
}
