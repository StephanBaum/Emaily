import { createHash, randomBytes } from "crypto";
import { prisma } from "./prisma";

const API_KEY_PREFIX = "emaily_sk_";

export interface ApiKeySession {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    teamId: string;
    teamName: string;
  };
}

function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const bytes = randomBytes(32).toString("hex");
  const raw = `${API_KEY_PREFIX}${bytes}`;
  const hash = hashApiKey(raw);
  const prefix = raw.slice(0, API_KEY_PREFIX.length + 8);
  return { raw, hash, prefix };
}

export async function validateApiKey(
  authHeader: string | null
): Promise<ApiKeySession | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token.startsWith(API_KEY_PREFIX)) return null;

  const hash = hashApiKey(token);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    include: {
      user: {
        select: { id: true, email: true, name: true, role: true },
      },
      team: {
        select: { id: true, name: true },
      },
    },
  });

  if (!apiKey) return null;

  // Check expiry
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Update lastUsedAt (fire and forget)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {});

  return {
    user: {
      id: apiKey.user.id,
      email: apiKey.user.email,
      name: apiKey.user.name || "",
      role: apiKey.user.role,
      teamId: apiKey.team.id,
      teamName: apiKey.team.name,
    },
  };
}

export function checkScope(scopes: string[], required: string): boolean {
  return scopes.includes(required) || scopes.includes("*");
}
