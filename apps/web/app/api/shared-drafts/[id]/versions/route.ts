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

  // Verify access to draft
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

  const versions = await prisma.draftVersion.findMany({
    where: { sharedDraftId: id },
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  return NextResponse.json(versions);
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
  const body = await request.json();
  const { versionId } = body;

  if (!versionId) {
    return NextResponse.json(
      { error: "versionId is required" },
      { status: 400 }
    );
  }

  // Verify access to draft with write permission
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

  // Check lock
  const hasValidLock =
    draft.lockedById === session.user.id &&
    draft.lockExpiresAt &&
    new Date(draft.lockExpiresAt) > new Date();

  if (!hasValidLock) {
    return NextResponse.json(
      { error: "You must acquire the lock to restore a version" },
      { status: 403 }
    );
  }

  // Get the version to restore
  const version = await prisma.draftVersion.findFirst({
    where: {
      id: versionId,
      sharedDraftId: id,
    },
  });

  if (!version) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  // Save current body as a new version before restoring
  await prisma.draftVersion.create({
    data: {
      sharedDraftId: id,
      userId: session.user.id,
      bodySnapshot: draft.body,
    },
  });

  // Prune old versions — keep only the 10 most recent
  const MAX_VERSIONS = 10;
  const allVersions = await prisma.draftVersion.findMany({
    where: { sharedDraftId: id },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  if (allVersions.length > MAX_VERSIONS) {
    const idsToDelete = allVersions.slice(MAX_VERSIONS).map((v) => v.id);
    await prisma.draftVersion.deleteMany({
      where: { id: { in: idsToDelete } },
    });
  }

  // Restore the version
  const updatedDraft = await prisma.sharedDraft.update({
    where: { id },
    data: {
      body: version.bodySnapshot,
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
