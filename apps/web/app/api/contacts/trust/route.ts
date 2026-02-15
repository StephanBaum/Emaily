import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TRUST_LEVEL_ORDER, type TrustLevel } from "@emaily/shared";

const VALID_TRUST_LEVELS = Object.keys(TRUST_LEVEL_ORDER);

/**
 * Upsert contact trust level by email address.
 * Creates the contact if it doesn't exist yet.
 */
export async function PUT(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { email, trustLevel, name } = body;

  if (!email || !trustLevel || !VALID_TRUST_LEVELS.includes(trustLevel)) {
    return NextResponse.json(
      { error: "email and valid trustLevel required" },
      { status: 400 }
    );
  }

  const teamId = session.user.teamId;
  const normalizedEmail = email.toLowerCase();
  const domain = normalizedEmail.split("@")[1] || null;

  const contact = await prisma.contact.upsert({
    where: {
      teamId_email: { teamId, email: normalizedEmail },
    },
    update: {
      trustLevel: trustLevel as TrustLevel,
      ...(name ? { name } : {}),
    },
    create: {
      teamId,
      email: normalizedEmail,
      name: name || null,
      domain,
      trustLevel: trustLevel as TrustLevel,
      interactionCount: 0,
      autoLearned: false,
    },
  });

  return NextResponse.json({ id: contact.id, trustLevel: contact.trustLevel });
}
