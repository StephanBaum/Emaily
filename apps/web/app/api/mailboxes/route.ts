import { NextRequest, NextResponse } from "next/server";
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
      imapHost: true,
      smtpHost: true,
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

  return NextResponse.json(result, {
    headers: {
      // Short cache since thread counts are dynamic
      "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { teamId: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const body = await request.json();
  const {
    emailAddress,
    displayName,
    type = "personal",
    imapHost,
    imapPort,
    imapUser,
    imapPassword,
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPassword,
    signature,
    folderInbox,
    folderArchive,
    folderTrash,
    folderDrafts,
    folderSent,
    folderSpam,
  } = body;

  if (!emailAddress || !imapHost || !imapUser || !imapPassword || !smtpHost || !smtpUser || !smtpPassword) {
    return NextResponse.json(
      { error: "Email address, IMAP, and SMTP configuration are required" },
      { status: 400 }
    );
  }

  const encryptionKey = process.env.ENCRYPTION_KEY;
  if (!encryptionKey) {
    return NextResponse.json({ error: "Encryption not configured" }, { status: 500 });
  }

  const { encrypt } = await import("@emaily/security");

  const mailbox = await prisma.mailbox.create({
    data: {
      emailAddress,
      displayName: displayName || emailAddress,
      type,
      teamId: user.teamId,
      imapHost,
      imapPort: imapPort || 993,
      imapUser,
      imapPasswordEnc: encrypt(imapPassword, encryptionKey),
      smtpHost,
      smtpPort: smtpPort || 587,
      smtpUser,
      smtpPasswordEnc: encrypt(smtpPassword, encryptionKey),
      signature,
      ...(folderInbox && { folderInbox }),
      ...(folderArchive && { folderArchive }),
      ...(folderTrash && { folderTrash }),
      ...(folderDrafts && { folderDrafts }),
      ...(folderSent && { folderSent }),
      ...(folderSpam && { folderSpam }),
    },
  });

  // Auto-create admin access for the creating user
  await prisma.mailboxAccess.create({
    data: {
      userId: session.user.id,
      mailboxId: mailbox.id,
      permission: "admin",
    },
  });

  return NextResponse.json(mailbox, { status: 201 });
}
