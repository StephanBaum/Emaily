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

  const access = await prisma.mailboxAccess.findFirst({
    where: { mailboxId: id, userId: session.user.id, permission: "admin" },
  });

  if (!access) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const records = await prisma.mailboxAccess.findMany({
    where: { mailboxId: id },
    include: {
      user: {
        select: { id: true, name: true, email: true, role: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(records);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const adminAccess = await prisma.mailboxAccess.findFirst({
    where: { mailboxId: id, userId: session.user.id, permission: "admin" },
  });

  if (!adminAccess) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { userId, permission = "read" } = body;

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  // Verify user is in same team
  const mailbox = await prisma.mailbox.findUnique({
    where: { id },
    select: { teamId: true },
  });

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true },
  });

  if (!mailbox || !targetUser || mailbox.teamId !== targetUser.teamId) {
    return NextResponse.json({ error: "User must be in the same team" }, { status: 400 });
  }

  const record = await prisma.mailboxAccess.upsert({
    where: {
      userId_mailboxId: { userId, mailboxId: id },
    },
    create: { userId, mailboxId: id, permission },
    update: { permission },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(record, { status: 201 });
}
