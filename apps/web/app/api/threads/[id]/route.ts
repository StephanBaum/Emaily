import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyThreadAccess } from "@/lib/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id } = await params;

  const { thread, error: accessError } = await verifyThreadAccess(session.user.id, id, {
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
  });
  if (accessError) return accessError;

  // Mark as seen
  const emails = (thread as any).emails;
  await prisma.seenBy.upsert({
    where: {
      threadId_userId: {
        threadId: thread.id,
        userId: session.user.id,
      },
    },
    update: {
      seenAt: new Date(),
      lastSeenEmailId: emails[emails.length - 1]?.id,
    },
    create: {
      threadId: thread.id,
      userId: session.user.id,
      lastSeenEmailId: emails[emails.length - 1]?.id,
    },
  });

  return Response.json(thread);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();
  const { status } = body;

  const { error: accessError } = await verifyThreadAccess(session.user.id, id);
  if (accessError) return accessError;

  const updated = await prisma.thread.update({
    where: { id },
    data: {
      status: status || undefined,
    },
  });

  return Response.json(updated);
}
