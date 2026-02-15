import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: { select: { users: true } },
    },
  });

  if (!team) {
    return NextResponse.json({ error: "Team not found" }, { status: 404 });
  }

  const members = await prisma.user.findMany({
    where: { teamId: user.teamId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      avatarMime: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    ...team,
    memberCount: team._count.users,
    members: members.map((m) => ({
      ...m,
      hasAvatar: !!m.avatarMime,
    })),
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
  const { name } = body;

  if (!name || typeof name !== "string" || name.trim().length === 0) {
    return NextResponse.json({ error: "Team name is required" }, { status: 400 });
  }

  const team = await prisma.team.update({
    where: { id: user.teamId },
    data: { name: name.trim() },
    select: { id: true, name: true },
  });

  return NextResponse.json(team);
}
