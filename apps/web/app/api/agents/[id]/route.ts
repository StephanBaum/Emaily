import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  const { name, role, systemPrompt, avatar, temperature, active, isDefault, tagIds } = body;

  const teamId = session.user.teamId;

  // Verify agent belongs to user's team
  const agent = await prisma.agent.findFirst({
    where: { id, teamId },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  // Check for duplicate name if renaming
  if (name && name.trim() !== agent.name) {
    const existing = await prisma.agent.findUnique({
      where: {
        teamId_name: { teamId, name: name.trim() },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An agent with this name already exists" },
        { status: 409 }
      );
    }
  }

  // If setting as default, unset other defaults
  if (isDefault && !agent.isDefault) {
    await prisma.agent.updateMany({
      where: { teamId, isDefault: true },
      data: { isDefault: false },
    });
  }

  // Update tag watches if provided
  if (tagIds !== undefined) {
    await prisma.agentTagWatch.deleteMany({
      where: { agentId: id },
    });

    if (tagIds.length > 0) {
      await prisma.agentTagWatch.createMany({
        data: tagIds.map((tagId: string) => ({ agentId: id, tagId })),
      });
    }
  }

  const updated = await prisma.agent.update({
    where: { id },
    data: {
      name: name?.trim() ?? undefined,
      role: role !== undefined ? (role?.trim() || "") : undefined,
      systemPrompt: systemPrompt !== undefined ? systemPrompt : undefined,
      avatar: avatar !== undefined ? (avatar || null) : undefined,
      temperature: typeof temperature === "number" ? temperature : undefined,
      active: active ?? undefined,
      isDefault: isDefault ?? undefined,
    },
    include: {
      tagWatches: { select: { tagId: true } },
    },
  });

  return NextResponse.json(updated);
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

  const agent = await prisma.agent.findFirst({
    where: { id, teamId: session.user.teamId },
  });

  if (!agent) {
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });
  }

  if (agent.isDefault) {
    return NextResponse.json(
      { error: "Cannot delete the default agent" },
      { status: 400 }
    );
  }

  await prisma.agent.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
