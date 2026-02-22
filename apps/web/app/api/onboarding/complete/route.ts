import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_AGENTS, DEFAULT_TAGS } from "@/lib/default-agents";
import { cacheInvalidate, cacheKeys } from "@/lib/cache";

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const teamId = session.user.teamId;
  const userId = session.user.id;

  const body = await request.json();
  const { agentNames, customAgent } = body as {
    agentNames: string[];
    customAgent?: { name: string; role: string; description: string };
  };

  if (!Array.isArray(agentNames) || agentNames.length === 0) {
    return NextResponse.json(
      { error: "At least one agent must be selected" },
      { status: 400 }
    );
  }

  // Validate agent names against catalog (except custom)
  const catalogNames = DEFAULT_AGENTS.map((a) => a.name);
  const invalidNames = agentNames.filter((n) => !catalogNames.includes(n));
  if (invalidNames.length > 0) {
    return NextResponse.json(
      { error: `Unknown agent names: ${invalidNames.join(", ")}` },
      { status: 400 }
    );
  }

  const selectedAgents = DEFAULT_AGENTS.filter((a) =>
    agentNames.includes(a.name)
  );

  // Create default tags if none exist for this team
  const existingTagCount = await prisma.tag.count({ where: { teamId } });

  let createdTags: { id: string; name: string }[] = [];
  if (existingTagCount === 0) {
    createdTags = await Promise.all(
      DEFAULT_TAGS.map((tag) =>
        prisma.tag.create({
          data: {
            teamId,
            name: tag.name,
            color: tag.color,
            aiAction: tag.aiAction,
            tagGroup: tag.tagGroup,
            description: tag.description,
          },
          select: { id: true, name: true },
        })
      )
    );
  } else {
    // Fetch existing tags for linking
    createdTags = await prisma.tag.findMany({
      where: { teamId },
      select: { id: true, name: true },
    });
  }

  const tagMap = new Map(createdTags.map((t) => [t.name, t.id]));

  // Create agents (skip if already exist)
  for (const agent of selectedAgents) {
    const existing = await prisma.agent.findUnique({
      where: { teamId_name: { teamId, name: agent.name } },
    });
    if (existing) continue;

    // If setting as default, unset other defaults first
    if (agent.isDefault) {
      await prisma.agent.updateMany({
        where: { teamId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const tagId = agent.tagLink ? tagMap.get(agent.tagLink) : undefined;

    await prisma.agent.create({
      data: {
        teamId,
        name: agent.name,
        role: agent.role,
        systemPrompt: agent.systemPrompt,
        temperature: agent.temperature,
        active: true,
        isDefault: agent.isDefault,
        tagWatches: tagId ? { create: { tagId } } : undefined,
      },
    });
  }

  // Create custom agent if provided
  if (customAgent?.name?.trim()) {
    const existing = await prisma.agent.findUnique({
      where: { teamId_name: { teamId, name: customAgent.name.trim() } },
    });
    if (!existing) {
      await prisma.agent.create({
        data: {
          teamId,
          name: customAgent.name.trim(),
          role: customAgent.role?.trim() || "",
          systemPrompt: customAgent.description?.trim() || "",
          temperature: 0.4,
          active: true,
          isDefault: false,
        },
      });
    }
  }

  // Mark onboarding as completed
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { preferences: true },
  });

  const currentPrefs =
    (user?.preferences as Record<string, unknown>) ?? {};
  await prisma.user.update({
    where: { id: userId },
    data: {
      preferences: { ...currentPrefs, onboardingCompleted: true },
    },
  });

  // Invalidate agents cache
  await cacheInvalidate(cacheKeys.agents(teamId));

  return NextResponse.json({ success: true });
}
