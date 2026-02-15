import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const MAX_AVATAR_SIZE = 200 * 1024; // 200KB
const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { data, mimeType } = body;

  if (!data || !mimeType) {
    return NextResponse.json(
      { error: "data and mimeType are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Invalid image type. Use PNG, JPEG, or WebP." },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(data, "base64");

  if (buffer.length > MAX_AVATAR_SIZE) {
    return NextResponse.json(
      { error: "Image too large. Maximum size is 200KB." },
      { status: 400 }
    );
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatar: buffer, avatarMime: mimeType },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatar: null, avatarMime: null },
  });

  return NextResponse.json({ success: true });
}
