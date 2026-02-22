import { NextResponse } from "next/server";
import { unifiedAuth } from "@/lib/unified-auth";
import { elevateTrustOnReply } from "@/lib/contacts";

export async function POST(request: Request) {
  const session = await unifiedAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { recipientAddress } = await request.json();
  if (!recipientAddress || typeof recipientAddress !== "string") {
    return NextResponse.json(
      { error: "recipientAddress is required" },
      { status: 400 }
    );
  }

  await elevateTrustOnReply(session.user.teamId, recipientAddress);

  return NextResponse.json({ success: true });
}
