import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyThreadAccess, apiError, apiSuccess } from "@/lib/api-helpers";
import { onThreadMutated } from "@/lib/thread-cache";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId, assignmentId } = await params;
  const body = await request.json();
  const { status, note, dueDate } = body;

  const { error: accessError } = await verifyThreadAccess(session.user.id, threadId);
  if (accessError) return accessError;

  // Verify assignment exists
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      threadId,
    },
  });

  if (!assignment) {
    return apiError("Assignment not found", 404);
  }

  // Validate status if provided
  const validStatuses = ["open", "in_progress", "done"];
  if (status && !validStatuses.includes(status)) {
    return apiError("Invalid status. Must be one of: open, in_progress, done", 400);
  }

  const updatedAssignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      ...(status && { status }),
      ...(note !== undefined && { note: note?.trim() || null }),
      ...(dueDate !== undefined && { dueDate: dueDate ? new Date(dueDate) : null }),
    },
    include: {
      assignedTo: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      assignedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  await onThreadMutated(threadId);

  return Response.json(updatedAssignment);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; assignmentId: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId, assignmentId } = await params;

  const { error: accessError } = await verifyThreadAccess(session.user.id, threadId);
  if (accessError) return accessError;

  // Verify assignment exists
  const assignment = await prisma.assignment.findFirst({
    where: {
      id: assignmentId,
      threadId,
    },
  });

  if (!assignment) {
    return apiError("Assignment not found", 404);
  }

  await prisma.assignment.delete({
    where: { id: assignmentId },
  });

  await onThreadMutated(threadId);

  return apiSuccess();
}
