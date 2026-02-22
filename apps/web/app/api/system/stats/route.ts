import { NextResponse } from "next/server";
import { requireAuth, apiError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { cacheGet } from "@/lib/cache";

export async function GET() {
  const { session, error } = await requireAuth();
  if (error) return error;

  if (session.user.role !== "admin") {
    return apiError("Admin access required", 403);
  }

  try {
    const [threads, emails, tags, users, mailboxes, contacts] =
      await Promise.all([
        prisma.thread.count(),
        prisma.email.count(),
        prisma.tag.count(),
        prisma.user.count(),
        prisma.mailbox.count(),
        prisma.contact.count(),
      ]);

    // Test Redis connectivity with a simple cache probe
    let cacheConnected = false;
    try {
      await cacheGet("__health_probe__");
      cacheConnected = true;
    } catch {
      cacheConnected = false;
    }

    return NextResponse.json({
      counts: { threads, emails, tags, users, mailboxes, contacts },
      cache: { connected: cacheConnected },
      uptime: process.uptime(),
    });
  } catch (err) {
    console.error("[System Stats] Error:", err);
    return apiError("Failed to fetch system stats", 500);
  }
}
