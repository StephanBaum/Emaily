import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = await prisma.tag.findMany({
    where: { teamId: session.user.teamId },
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
  const { name, color, aiAction, tagGroup } = body;

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
