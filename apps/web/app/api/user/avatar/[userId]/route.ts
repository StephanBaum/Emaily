import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatar: true, avatarMime: true },
  });

  if (!user?.avatar || !user.avatarMime) {
    return NextResponse.json({ error: "No avatar" }, { status: 404 });
  }

  return new NextResponse(user.avatar, {
    headers: {
      "Content-Type": user.avatarMime,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
