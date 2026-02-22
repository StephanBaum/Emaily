import { NextRequest, NextResponse } from "next/server";
import { unifiedAuth } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await unifiedAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const trustLevel = searchParams.get("trustLevel");
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const cursor = searchParams.get("cursor");

  const where: Record<string, unknown> = {
    teamId: session.user.teamId,
  };

  if (trustLevel) {
    where.trustLevel = trustLevel;
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { lastContactedAt: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      domain: true,
      trustLevel: true,
      interactionCount: true,
      repliedToCount: true,
      lastContactedAt: true,
    },
  });

  const hasNextPage = contacts.length > limit;
  const results = hasNextPage ? contacts.slice(0, limit) : contacts;

  return NextResponse.json({
    contacts: results,
    pagination: {
      hasNextPage,
      nextCursor: hasNextPage ? results[results.length - 1]?.id : null,
      limit,
    },
  });
}
