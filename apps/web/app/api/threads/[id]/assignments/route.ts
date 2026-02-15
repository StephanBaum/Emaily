import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
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
          some: {
            userId: session.user.id,
          },
        },
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

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

  return NextResponse.json(assignments);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  const body = await request.json();
  const { assignedToId, note, dueDate } = body;

  if (!assignedToId) {
    return NextResponse.json(
      { error: "assignedToId is required" },
      { status: 400 }
    );
  }

  // Verify access to thread and get team info
  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      mailbox: {
        access: {
          some: {
            userId: session.user.id,
          },
        },
      },
    },
    include: {
      mailbox: true,
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Verify assignee is in the same team
  const assignee = await prisma.user.findFirst({
    where: {
      id: assignedToId,
      teamId: thread.mailbox.teamId,
    },
  });

  if (!assignee) {
    return NextResponse.json(
      { error: "Assignee must be a team member" },
      { status: 400 }
    );
  }

  // Check for existing assignment to same user
  const existingAssignment = await prisma.assignment.findFirst({
    where: {
      threadId,
      assignedToId,
    },
  });

  if (existingAssignment) {
    return NextResponse.json(
      { error: "User is already assigned to this thread" },
      { status: 400 }
    );
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
      teamId: thread.mailbox.teamId,
      type: "assignment",
      title: `Assigned to you: ${thread.subject}`,
      message: `By ${session.user.name}`,
      targetType: "thread",
      targetId: threadId,
    });
  }

  return NextResponse.json(assignment, { status: 201 });
}
