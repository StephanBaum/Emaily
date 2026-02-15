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

  const mailbox = await prisma.mailbox.findFirst({
    where: {
      id,
      access: { some: { userId: session.user.id } },
    },
    select: {
      id: true,
      emailAddress: true,
      displayName: true,
      type: true,
      imapHost: true,
      imapPort: true,
      imapUser: true,
      smtpHost: true,
      smtpPort: true,
      smtpUser: true,
      signature: true,
      folderInbox: true,
      folderArchive: true,
      folderTrash: true,
      folderDrafts: true,
      folderSent: true,
      folderSpam: true,
      createdAt: true,
    },
  });

  if (!mailbox) {
    return NextResponse.json({ error: "Mailbox not found" }, { status: 404 });
  }

  return NextResponse.json(mailbox);
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

  // Verify admin access
  const access = await prisma.mailboxAccess.findFirst({
    where: { mailboxId: id, userId: session.user.id, permission: "admin" },
  });

  if (!access) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const updateData: Record<string, unknown> = {};

  const stringFields = [
    "displayName", "signature", "imapHost", "imapUser", "smtpHost", "smtpUser",
    "folderInbox", "folderArchive", "folderTrash", "folderDrafts", "folderSent", "folderSpam",
  ];

  for (const field of stringFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  if (body.imapPort !== undefined) updateData.imapPort = body.imapPort;
  if (body.smtpPort !== undefined) updateData.smtpPort = body.smtpPort;
  if (body.type !== undefined) updateData.type = body.type;

  // Re-encrypt passwords if changed
  if (body.imapPassword || body.smtpPassword) {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      return NextResponse.json({ error: "Encryption not configured" }, { status: 500 });
    }
    const { encrypt } = await import("@emaily/security");
    if (body.imapPassword) {
      updateData.imapPasswordEnc = encrypt(body.imapPassword, encryptionKey);
    }
    if (body.smtpPassword) {
      updateData.smtpPasswordEnc = encrypt(body.smtpPassword, encryptionKey);
    }
  }

  const mailbox = await prisma.mailbox.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json(mailbox);
}

export async function DELETE(
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

  await prisma.mailbox.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
