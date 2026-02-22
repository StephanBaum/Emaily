import { NextRequest, NextResponse } from "next/server";
import { unifiedAuth } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";
import { cacheInvalidate, cacheKeys } from "@/lib/cache";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await unifiedAuth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { name, color, aiAction, autoRules, minTrustLevel, active, tagGroup } = body;

  // Verify tag belongs to user's team
  const tag = await prisma.tag.findFirst({
    where: { id, teamId: session.user.teamId },
  });

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  // Check for duplicate name if renaming
  if (name && name.trim() !== tag.name) {
    const existing = await prisma.tag.findUnique({
      where: {
        teamId_name: {
          teamId: session.user.teamId,
          name: name.trim(),
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A tag with this name already exists" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.tag.update({
    where: { id },
    data: {
      name: name?.trim() ?? undefined,
      color: color ?? undefined,
      aiAction: aiAction ?? undefined,
      autoRules: autoRules !== undefined ? autoRules : undefined,
      minTrustLevel: minTrustLevel ?? undefined,
      tagGroup: tagGroup !== undefined ? (tagGroup?.trim() || null) : undefined,
      active: active ?? undefined,
    },
    include: {
      _count: {
        select: { threads: true },
      },
    },
  });

  // Invalidate tags cache
  await cacheInvalidate(`${cacheKeys.tags(session.user.teamId)}:default`);
  await cacheInvalidate(`${cacheKeys.tags(session.user.teamId)}:picker`);

  return NextResponse.json(updated);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await unifiedAuth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify tag belongs to user's team
  const tag = await prisma.tag.findFirst({
    where: { id, teamId: session.user.teamId },
  });

  if (!tag) {
    return NextResponse.json({ error: "Tag not found" }, { status: 404 });
  }

  await prisma.tag.delete({ where: { id } });

  // Invalidate tags cache
  await cacheInvalidate(`${cacheKeys.tags(session.user.teamId)}:default`);
  await cacheInvalidate(`${cacheKeys.tags(session.user.teamId)}:picker`);

  return NextResponse.json({ success: true });
}
