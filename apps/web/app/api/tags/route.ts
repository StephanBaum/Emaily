import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Tags hidden from sidebar navigation (they have dedicated nav items).
// Still available in tag picker for manual assignment.
const SIDEBAR_HIDDEN_TAGS = ["spam"];

export async function GET(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const context = searchParams.get("context"); // "sidebar" or "picker"

  const where: Record<string, unknown> = { teamId: session.user.teamId };

  // Hide spam tag from sidebar (it has its own nav item) but show in picker
  if (context !== "picker") {
    where.NOT = { name: { in: SIDEBAR_HIDDEN_TAGS, mode: "insensitive" } };
  }

  const tags = await prisma.tag.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { threads: true },
      },
    },
  });

  return NextResponse.json(tags);
}

export async function POST(request: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, color, aiAction, minTrustLevel, tagGroup } = body;

  if (!name?.trim()) {
    return NextResponse.json(
      { error: "Tag name is required" },
      { status: 400 }
    );
  }

  // Check for duplicate name
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

  const tag = await prisma.tag.create({
    data: {
      teamId: session.user.teamId,
      name: name.trim(),
      color: color || "#6366f1",
      aiAction: aiAction || "none",
      minTrustLevel: minTrustLevel || "stranger",
      tagGroup: tagGroup?.trim() || null,
    },
    include: {
      _count: {
        select: { threads: true },
      },
    },
  });

  return NextResponse.json(tag, { status: 201 });
}
