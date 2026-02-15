import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyThreadAccess, apiError } from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId } = await params;

  const { error: accessError } = await verifyThreadAccess(session.user.id, threadId);
  if (accessError) return accessError;

  const assignments = await prisma.assignment.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
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

  return Response.json(assignments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: threadId } = await params;
  const body = await request.json();
  const { assignedToId, note, dueDate } = body;

  if (!assignedToId) {
    return apiError("assignedToId is required", 400);
  }

  const { thread, error: accessError } = await verifyThreadAccess(session.user.id, threadId, {
    mailbox: true,
  });
  if (accessError) return accessError;

  const mailbox = (thread as any).mailbox;

  // Verify assignee is in the same team
  const assignee = await prisma.user.findFirst({
    where: {
      id: assignedToId,
      teamId: mailbox.teamId,
    },
  });

  if (!assignee) {
    return apiError("Assignee must be a team member", 400);
  }

  // Check for existing assignment to same user
  const existingAssignment = await prisma.assignment.findFirst({
    where: {
      threadId,
      assignedToId,
    },
  });

  if (existingAssignment) {
    return apiError("User is already assigned to this thread", 400);
  }

  const assignment = await prisma.assignment.create({
    data: {
      threadId,
      assignedToId,
      assignedById: session.user.id,
      note: note?.trim() || null,
      dueDate: dueDate ? new Date(dueDate) : null,
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

  // Notify assignee
  if (assignedToId !== session.user.id) {
    const { createNotification } = await import("@/lib/services/notification-service");
    await createNotification({
      userId: assignedToId,
      teamId: mailbox.teamId,
      type: "assignment",
      title: `Assigned to you: ${thread.subject}`,
      message: `By ${session.user.name}`,
      targetType: "thread",
      targetId: threadId,
    });
  }

  return Response.json(assignment, { status: 201 });
}
