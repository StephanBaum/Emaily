import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, verifyThreadAccess } from "@/lib/api-helpers";
import { getCachedThreadEmails, onThreadMutated } from "@/lib/thread-cache";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id } = await params;

  // Fetch thread metadata (without emails) and cached emails in parallel
  const [threadAccess, emails] = await Promise.all([
    verifyThreadAccess(session.user.id, id, {
      mailbox: {
        select: {
          id: true,
          emailAddress: true,
          displayName: true,
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
    }),
    getCachedThreadEmails(id),
  ]);

  if (threadAccess.error) return threadAccess.error;
  const thread = threadAccess.thread;

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
      lastSeenEmailId: emails[emails.length - 1]?.id,
    },
    create: {
      threadId: thread.id,
      userId: session.user.id,
      lastSeenEmailId: emails[emails.length - 1]?.id,
    },
  });

  return Response.json({ ...thread, emails });
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

  await onThreadMutated(id);

  return Response.json(updated);
}
