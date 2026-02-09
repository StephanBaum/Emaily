import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getAIProviderStatus } from "@/lib/ai";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = await getAIProviderStatus();
  return NextResponse.json(status);
}
