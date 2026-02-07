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

  const draft = await prisma.sharedDraft.findFirst({
    where: {
      id,
      mailbox: {
        access: {
          some: {
            userId: session.user.id,
          },
        },
      },
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      thread: {
        select: {
          id: true,
          subject: true,
        },
      },
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  // Check if lock is expired
  let isLocked = false;
  let lockedBy = null;

  if (draft.lockedById && draft.lockExpiresAt) {
    if (new Date(draft.lockExpiresAt) > new Date()) {
      isLocked = true;
      if (draft.lockedById !== session.user.id) {
        const lockHolder = await prisma.user.findUnique({
          where: { id: draft.lockedById },
          select: { id: true, name: true, email: true },
        });
        lockedBy = lockHolder;
      }
    }
  }

  return NextResponse.json({
    ...draft,
    isLocked,
    lockedBy,
    isLockedByMe: draft.lockedById === session.user.id && isLocked,
  });
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
  const body = await request.json();
  const { body: draftBody, subject, toAddresses, ccAddresses, bccAddresses, status } = body;

  // Find draft with access check
  const draft = await prisma.sharedDraft.findFirst({
    where: {
      id,
      mailbox: {
        access: {
          some: {
            userId: session.user.id,
            permission: { in: ["write", "admin"] },
          },
        },
      },
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  // Check lock - must have lock to edit body
  if (draftBody !== undefined) {
    const hasValidLock =
      draft.lockedById === session.user.id &&
      draft.lockExpiresAt &&
      new Date(draft.lockExpiresAt) > new Date();

    if (!hasValidLock) {
      return NextResponse.json(
        { error: "You must acquire the lock to edit this draft" },
        { status: 403 }
      );
    }
  }

  // If updating body, save a version
  if (draftBody !== undefined && draftBody !== draft.body) {
    await prisma.draftVersion.create({
      data: {
        sharedDraftId: id,
        userId: session.user.id,
        bodySnapshot: draft.body,
      },
    });
  }

  const updatedDraft = await prisma.sharedDraft.update({
    where: { id },
    data: {
      ...(draftBody !== undefined && { body: draftBody }),
      ...(subject !== undefined && { subject }),
      ...(toAddresses !== undefined && { toAddresses }),
      ...(ccAddresses !== undefined && { ccAddresses }),
      ...(bccAddresses !== undefined && { bccAddresses }),
      ...(status !== undefined && { status }),
    },
    include: {
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json(updatedDraft);
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

  const draft = await prisma.sharedDraft.findFirst({
    where: {
      id,
      mailbox: {
        access: {
          some: {
            userId: session.user.id,
            permission: { in: ["write", "admin"] },
          },
        },
      },
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  await prisma.sharedDraft.delete({
    where: { id },
  });

  return NextResponse.json({ success: true });
}
