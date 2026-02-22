import { auth } from "./auth";
import { validateApiKey } from "./api-key-auth";
import { headers } from "next/headers";

export type UnifiedSession = {
  user: {
    id: string;
    email: string;
    name: string;
    role: string;
    teamId: string;
    teamName: string;
  };
  isApiKey?: boolean;
};

/**
 * Check session auth first, then fall back to API key auth.
 * Use this in API routes that should support both web UI and MCP access.
 */
export async function unifiedAuth(): Promise<UnifiedSession | null> {
  // Try NextAuth session first
  const session = await auth();
  if (session?.user) {
    return {
      user: {
        id: session.user.id as string,
        email: session.user.email as string,
        name: session.user.name as string,
        role: session.user.role as string,
        teamId: session.user.teamId as string,
        teamName: session.user.teamName as string,
      },
    };
  }

  // Fall back to API key
  const headersList = await headers();
  const authHeader = headersList.get("authorization");
  const apiKeySession = await validateApiKey(authHeader);
  if (apiKeySession) {
    return { ...apiKeySession, isApiKey: true };
  }

  return null;
}
