import { NextResponse } from "next/server";
import { unifiedAuth } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await unifiedAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const email = await prisma.email.findUnique({
    where: { id },
    include: {
      attachments: {
        select: { id: true, filename: true, contentType: true, size: true },
      },
      thread: {
        select: {
          id: true,
          mailboxId: true,
          subject: true,
        },
      },
    },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // Verify mailbox access
  const hasAccess = await prisma.mailboxAccess.findFirst({
    where: { userId: session.user.id, mailboxId: email.thread.mailboxId },
  });

  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ email });
}
