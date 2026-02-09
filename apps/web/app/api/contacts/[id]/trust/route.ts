import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TRUST_LEVEL_ORDER, type TrustLevel } from "@emailautomation/shared";

const VALID_TRUST_LEVELS = Object.keys(TRUST_LEVEL_ORDER);

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { trustLevel } = body;

  if (!trustLevel || !VALID_TRUST_LEVELS.includes(trustLevel)) {
    return NextResponse.json(
      { error: `Invalid trust level. Must be one of: ${VALID_TRUST_LEVELS.join(", ")}` },
      { status: 400 }
    );
  }

  // Verify contact belongs to user's team
  const contact = await prisma.contact.findFirst({
    where: {
      id,
      teamId: session.user.teamId,
    },
  });

  if (!contact) {
    return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  }

  const updated = await prisma.contact.update({
    where: { id },
    data: { trustLevel: trustLevel as TrustLevel },
  });

  return NextResponse.json(updated);
}
