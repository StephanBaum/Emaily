import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Lock duration: 30 minutes
const LOCK_DURATION_MS = 30 * 60 * 1000;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { lockType = "editing" } = body;

  // Validate lockType
  if (!["editing", "generating"].includes(lockType)) {
    return NextResponse.json(
      { error: "Invalid lockType. Must be 'editing' or 'generating'" },
      { status: 400 }
    );
  }

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

  // Check if currently locked by someone else
  if (draft.lockedById && draft.lockExpiresAt) {
    const lockExpired = new Date(draft.lockExpiresAt) <= new Date();
    const isMyLock = draft.lockedById === session.user.id;

    if (!lockExpired && !isMyLock) {
      const lockHolder = await prisma.user.findUnique({
        where: { id: draft.lockedById },
        select: { id: true, name: true, email: true },
      });

      return NextResponse.json(
        {
          error: "Draft is locked by another user",
          lockedBy: lockHolder,
          lockExpiresAt: draft.lockExpiresAt,
        },
        { status: 409 }
      );
    }
  }

  // Acquire or refresh lock
  const lockExpiresAt = new Date(Date.now() + LOCK_DURATION_MS);

  const updatedDraft = await prisma.sharedDraft.update({
    where: { id },
    data: {
      lockedById: session.user.id,
      lockType,
      lockExpiresAt,
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

  return NextResponse.json({
    ...updatedDraft,
    isLocked: true,
    isLockedByMe: true,
    lockedBy: null,
  });
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
          },
        },
      },
    },
  });

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  // Only allow releasing own lock
  if (draft.lockedById !== session.user.id) {
    return NextResponse.json(
      { error: "You can only release your own lock" },
      { status: 403 }
    );
  }

  const updatedDraft = await prisma.sharedDraft.update({
    where: { id },
    data: {
      lockedById: null,
      lockType: null,
      lockExpiresAt: null,
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

  return NextResponse.json({
    ...updatedDraft,
    isLocked: false,
    isLockedByMe: false,
    lockedBy: null,
  });
}
