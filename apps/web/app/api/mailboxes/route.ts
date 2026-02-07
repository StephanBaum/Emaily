import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Debug log
  console.log("[API /mailboxes] Fetching for user:", session.user.id, session.user.email);

  const mailboxes = await prisma.mailbox.findMany({
    where: {
      access: {
        some: {
          userId: session.user.id,
        },
      },
    },
    select: {
      id: true,
      emailAddress: true,
      displayName: true,
      type: true,
      _count: {
        select: {
          threads: {
            where: {
              status: "open",
            },
          },
        },
      },
    },
    orderBy: {
      displayName: "asc",
    },
  });

  console.log("[API /mailboxes] Found", mailboxes.length, "mailboxes");

  return NextResponse.json(mailboxes);
}
