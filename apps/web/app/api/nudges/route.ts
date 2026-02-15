import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getNudgesForUser } from "@/lib/services/nudges-service";
import { cacheOrFetch, cacheKeys, CACHE_TTL } from "@/lib/cache";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const start = performance.now();
    const nudges = await cacheOrFetch(
      cacheKeys.nudges(session.user.id),
      CACHE_TTL.nudges,
      () => getNudgesForUser(session.user.id)
    );
    console.debug(`[DB] GET /api/nudges: ${Math.round(performance.now() - start)}ms`);
    return NextResponse.json(nudges);
  } catch (error) {
    console.error("Failed to fetch nudges:", error);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
