import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, validatePasswordStrength } from "@emaily/security";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, password, teamId, newTeamName } = body;

  if (!name?.trim() || !email?.trim() || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  const strength = validatePasswordStrength(password);
  if (!strength.valid) {
    return NextResponse.json(
      { error: "Password too weak", details: strength.errors },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  if (teamId) {
    const team = await prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      return NextResponse.json({ error: "Team not found" }, { status: 404 });
    }

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash,
        role: "member",
        teamId,
      },
    });

    const sharedMailboxes = await prisma.mailbox.findMany({
      where: { teamId, type: "shared" },
      select: { id: true },
    });

    if (sharedMailboxes.length > 0) {
      await prisma.mailboxAccess.createMany({
        data: sharedMailboxes.map((m) => ({
          userId: user.id,
          mailboxId: m.id,
          permission: "read",
        })),
      });
    }

    return NextResponse.json({ userId: user.id, teamId }, { status: 201 });
  } else {
    const teamName = newTeamName?.trim() || email.split("@")[1].split(".")[0];

    const team = await prisma.team.create({
      data: { name: teamName },
    });

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash,
        role: "admin",
        teamId: team.id,
      },
    });

    return NextResponse.json({ userId: user.id, teamId: team.id }, { status: 201 });
  }
}
