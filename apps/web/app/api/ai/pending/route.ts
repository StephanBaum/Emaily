import { NextResponse } from "next/server";
import { unifiedAuth } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await unifiedAuth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = session.user.teamId;

  const threads = await prisma.thread.findMany({
    where: {
      mailbox: { teamId },
      status: { not: "quarantined" },
      aiStatus: "pending",
    },
    select: { id: true, subject: true },
    orderBy: { lastActivityAt: "asc" },
  });

  return NextResponse.json({ threads, total: threads.length });
}
