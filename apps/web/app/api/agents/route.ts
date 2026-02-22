import { NextRequest, NextResponse } from "next/server";
import { unifiedAuth } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";
import { cacheOrFetch, cacheInvalidate, cacheKeys, CACHE_TTL } from "@/lib/cache";

export async function GET() {
  const session = await unifiedAuth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = session.user.teamId;
  const agents = await cacheOrFetch(cacheKeys.agents(teamId), CACHE_TTL.agents, async () => {
    return prisma.agent.findMany({
      where: { teamId },
      include: {
        tagWatches: {
          select: { tagId: true },
        },
      },
      orderBy: [{ isDefault: "desc" }, { name: "asc" }],
    });
  });

  return NextResponse.json(agents, {
    headers: {
      "Cache-Control": "private, max-age=120, stale-while-revalidate=300",
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await unifiedAuth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, role, systemPrompt, avatar, temperature, active, isDefault, tagIds } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const teamId = session.user.teamId;

  // Check for duplicate name
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

  // If setting as default, unset other defaults
  if (isDefault) {
    await prisma.agent.updateMany({
      where: { teamId, isDefault: true },
      data: { isDefault: false },
    });
  }

  const agent = await prisma.agent.create({
    data: {
      teamId,
      name: name.trim(),
      role: role?.trim() || "",
      systemPrompt: systemPrompt || "",
      avatar: avatar || null,
      temperature: typeof temperature === "number" ? temperature : 0.4,
      active: active ?? true,
      isDefault: isDefault ?? false,
      tagWatches: tagIds?.length
        ? {
            create: tagIds.map((tagId: string) => ({ tagId })),
          }
        : undefined,
    },
    include: {
      tagWatches: { select: { tagId: true } },
    },
  });

  // Invalidate agents cache
  await cacheInvalidate(cacheKeys.agents(teamId));

  return NextResponse.json(agent, { status: 201 });
}
