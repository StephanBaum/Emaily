import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-key-auth";

// GET: List user's API keys (never returns the raw key)
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id as string },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

// POST: Create a new API key
export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, scopes, expiresAt } = body;

  if (!name || typeof name !== "string") {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const validScopes = [
    "threads:read", "threads:write", "email:read", "email:send",
    "tags:read", "tags:write", "drafts:read", "drafts:write",
    "comments:read", "comments:write", "assignments:read", "assignments:write",
    "contacts:read", "contacts:write", "ai:read", "ai:write",
    "mailboxes:read", "sync:trigger", "notifications:read", "notifications:write",
    "*",
  ];

  const requestedScopes = scopes || ["*"];
  const invalidScopes = requestedScopes.filter((s: string) => !validScopes.includes(s));
  if (invalidScopes.length > 0) {
    return NextResponse.json(
      { error: `Invalid scopes: ${invalidScopes.join(", ")}` },
      { status: 400 }
    );
  }

  const { raw, hash, prefix } = generateApiKey();

  await prisma.apiKey.create({
    data: {
      name,
      keyHash: hash,
      keyPrefix: prefix,
      userId: session.user.id as string,
      teamId: session.user.teamId as string,
      scopes: requestedScopes,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  // Return the raw key ONCE — it can never be retrieved again
  return NextResponse.json({
    key: raw,
    prefix,
    name,
    scopes: requestedScopes,
    message: "Save this key now. It cannot be shown again.",
  }, { status: 201 });
}
