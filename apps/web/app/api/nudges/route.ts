import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNudgesForUser } from "@/lib/services/nudges-service";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const nudges = await getNudgesForUser(session.user.id);
    return NextResponse.json(nudges);
  } catch (error) {
    console.error("Failed to fetch nudges:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
