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

  const { id } = await params;

  // Get thread with access check
  const thread = await prisma.thread.findFirst({
    where: {
      id,
      mailbox: {
        access: {
          some: {
            userId: session.user.id,
          },
        },
      },
    },
    include: {
      mailbox: {
        select: {
          id: true,
          emailAddress: true,
          displayName: true,
        },
      },
      emails: {
        orderBy: { date: "asc" },
        include: {
          attachments: {
            select: {
              id: true,
              filename: true,
              contentType: true,
              size: true,
            },
          },
        },
      },
      tags: {
        include: {
          tag: true,
        },
      },
      assignments: {
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
            },
          },
        },
      },
      comments: {
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
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Mark as seen
  await prisma.seenBy.upsert({
    where: {
      threadId_userId: {
        threadId: thread.id,
        userId: session.user.id,
      },
    },
    update: {
      seenAt: new Date(),
      lastSeenEmailId: thread.emails[thread.emails.length - 1]?.id,
    },
    create: {
      threadId: thread.id,
      userId: session.user.id,
      lastSeenEmailId: thread.emails[thread.emails.length - 1]?.id,
    },
  });

  return NextResponse.json(thread);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  // Verify access
  const thread = await prisma.thread.findFirst({
    where: {
      id,
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

  // Update thread
  const updated = await prisma.thread.update({
    where: { id },
    data: {
      status: status || undefined,
    },
  });

  return NextResponse.json(updated);
}
