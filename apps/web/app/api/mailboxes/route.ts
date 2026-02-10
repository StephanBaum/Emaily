import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  const mailboxes = await prisma.mailbox.findMany({
    where: {
      access: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
      emailAddress: true,
      displayName: true,
      type: true,
      threads: {
        where: {
          status: "open",
          seenBy: { none: { userId } },
        },
        select: { id: true },
      },
    },
    orderBy: {
      displayName: "asc",
    },
  });

  // Transform to expected shape with _count
  const result = mailboxes.map(({ threads, ...mailbox }) => ({
    ...mailbox,
    _count: { threads: threads.length },
  }));

  return NextResponse.json(result);
}
