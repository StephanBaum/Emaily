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

  const { thread, error: accessError } = await verifyThreadAccess(session.user.id, threadId, {
    emails: {
      select: { id: true },
      orderBy: { date: "asc" },
    },
  });
  if (accessError) return accessError;

  // Fetch intents for all emails in this thread
  const emailIds = (thread as any).emails.map((e: any) => e.id);
  const intents = await prisma.emailIntent.findMany({
    where: {
      emailId: { in: emailIds },
    },
    include: {
      email: {
        select: {
          id: true,
          fromAddress: true,
          fromName: true,
          subject: true,
          date: true,
        },
      },
    },
    orderBy: {
      extractedAt: "asc",
    },
  });

  return Response.json(intents);
}
