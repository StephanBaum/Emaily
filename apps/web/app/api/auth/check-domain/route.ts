import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email } = body;

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  const domain = email.split("@")[1].toLowerCase();

  const usersWithDomain = await prisma.user.findMany({
    where: {
      email: { endsWith: `@${domain}` },
    },
    select: {
      team: { select: { id: true, name: true } },
    },
    take: 1,
  });

  if (usersWithDomain.length > 0) {
    const team = usersWithDomain[0].team;
    return NextResponse.json({ teamFound: true, teamName: team.name, teamId: team.id });
  }

  const teamName = domain.split(".")[0].charAt(0).toUpperCase() + domain.split(".")[0].slice(1);
  return NextResponse.json({ teamFound: false, suggestedName: teamName });
}
