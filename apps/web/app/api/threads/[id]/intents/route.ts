import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: NextRequest,
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
          some: { userId: session.user.id },
        },
      },
    },
    include: {
      emails: {
        select: { id: true },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  // Fetch intents for all emails in this thread
  const emailIds = thread.emails.map((e) => e.id);
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

  return NextResponse.json(intents);
}
