import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_PROVIDERS = ["ollama", "gemini"] as const;

interface TeamAISettings {
  aiProvider?: string;
  aiModel?: string;
}

export async function GET() {
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

  const team = await prisma.team.findUnique({
    where: { id: user.teamId },
    select: { settings: true },
  });

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const settings = (team.settings ?? {}) as TeamAISettings;

  return NextResponse.json({
    aiProvider: settings.aiProvider || process.env.AI_PROVIDER || "ollama",
    aiModel: settings.aiModel || null,
  });
}

export async function PATCH(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, teamId: true },
  });

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const body = await request.json();
  const { aiProvider, aiModel } = body;

  if (aiProvider && !VALID_PROVIDERS.includes(aiProvider)) {
    return NextResponse.json(
      { error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(", ")}` },
      { status: 400 }
    );
  }

  const team = await prisma.team.findUnique({
    where: { id: user.teamId },
    select: { settings: true },
  });

  const existingSettings = (team?.settings ?? {}) as Record<string, unknown>;
  const updatedSettings = {
    ...existingSettings,
    ...(aiProvider !== undefined && { aiProvider }),
    ...(aiModel !== undefined && { aiModel }),
  };

  await prisma.team.update({
    where: { id: user.teamId },
    data: { settings: updatedSettings },
  });

  return NextResponse.json({
    aiProvider: updatedSettings.aiProvider || process.env.AI_PROVIDER || "ollama",
    aiModel: updatedSettings.aiModel || null,
  });
}
