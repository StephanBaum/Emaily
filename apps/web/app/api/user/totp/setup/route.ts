import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateTotpSecret, generateTotpUri } from "@emaily/security";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { totpEnabled: true, email: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (user.totpEnabled) {
    return NextResponse.json(
      { error: "2FA is already enabled" },
      { status: 400 }
    );
  }

  const secret = generateTotpSecret();
  const uri = generateTotpUri(secret, user.email, "Emaily");

  await prisma.user.update({
    where: { id: session.user.id },
    data: { totpSecret: secret },
  });

  return NextResponse.json({ secret, uri });
}
