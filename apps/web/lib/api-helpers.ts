import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Return typed error response */
export function apiError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** Return success response */
export function apiSuccess(data?: unknown, status = 200) {
  return NextResponse.json(data ?? { success: true }, { status });
}

/** Get authenticated session or return 401 response */
export async function requireAuth() {
  const session = await auth();
  if (!session?.user) return { session: null, error: apiError("Unauthorized", 401) } as const;
  return { session, error: null } as const;
}

/** Verify user can access thread via mailbox membership. Returns thread or 404. */
export async function verifyThreadAccess(
  userId: string,
  threadId: string,
  include?: Record<string, unknown>
) {
  const thread = await prisma.thread.findFirst({
    where: {
      id: threadId,
      mailbox: { access: { some: { userId } } },
    },
    ...(include ? { include } : {}),
  });
  if (!thread) return { thread: null, error: apiError("Thread not found", 404) } as const;
  return { thread, error: null } as const;
}
