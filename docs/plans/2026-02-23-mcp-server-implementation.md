# MCP Server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone MCP server package that enables AI agents (Claude Desktop, etc.) to manage email through typed MCP tools, backed by the existing Next.js API.

**Architecture:** Thin MCP shell (`packages/mcp-server`) that forwards tool calls as HTTP requests to `apps/web` API routes. API key auth added to web app. ~25 MCP tools covering threads, email, tags, drafts, collaboration, AI, contacts, and notifications.

**Tech Stack:** `@modelcontextprotocol/sdk` (MCP), `@emaily/shared` (types), Next.js API routes (existing), Prisma (ApiKey model), SHA-256 hashing (key storage).

**Design doc:** `docs/plans/2026-02-23-mcp-server-design.md`

---

## Phase 1: API Key Infrastructure (Web App)

### Task 1: Add ApiKey model to Prisma schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`

**Step 1: Add ApiKey model after the existing RefreshToken model**

Add to `packages/database/prisma/schema.prisma`, after the `RefreshToken` model and before `Mailbox`:

```prisma
model ApiKey {
  id         String    @id @default(cuid())
  name       String
  keyHash    String    @unique
  keyPrefix  String
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamId     String
  team       Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
  scopes     String[]
  lastUsedAt DateTime?
  expiresAt  DateTime?
  createdAt  DateTime  @default(now())

  @@index([keyHash])
  @@map("api_keys")
}
```

Also add the reverse relation fields to `User` and `Team`:
- In `User` model: `apiKeys ApiKey[]`
- In `Team` model: `apiKeys ApiKey[]`

**Step 2: Generate Prisma client**

Run: `cd packages/database && pnpm db:generate`
Expected: Prisma client regenerated with ApiKey model.

**Step 3: Push schema to database**

Run: `cd packages/database && pnpm db:push`
Expected: `api_keys` table created in PostgreSQL.

**Step 4: Verify with Prisma Studio**

Run: `cd packages/database && pnpm db:studio`
Expected: `ApiKey` model appears in Prisma Studio with correct fields.

**Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma
git commit -m "feat: add ApiKey model for MCP/API authentication"
```

---

### Task 2: Add API key auth middleware to web app

**Files:**
- Create: `apps/web/lib/api-key-auth.ts`
- Modify: `apps/web/lib/auth.ts` (or create a wrapper)

**Step 1: Create the API key validation utility**

Create `apps/web/lib/api-key-auth.ts`:

```typescript
import { createHash } from "crypto";
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
  const randomBytes = require("crypto").randomBytes(32).toString("hex");
  const raw = `${API_KEY_PREFIX}${randomBytes}`;
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
  prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => {});

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
```

**Step 2: Create a unified auth helper that checks both session and API key**

Create `apps/web/lib/unified-auth.ts`:

```typescript
import { auth } from "./auth";
import { validateApiKey, type ApiKeySession } from "./api-key-auth";
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
```

**Step 3: Verify the web app builds**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds (new files are not imported anywhere yet).

**Step 4: Commit**

```bash
git add apps/web/lib/api-key-auth.ts apps/web/lib/unified-auth.ts
git commit -m "feat: add API key auth and unified auth helper"
```

---

### Task 3: Migrate existing API routes to use unified auth

This is the critical step: existing routes call `auth()` directly. We need to swap them to `unifiedAuth()` so API key requests work. The return shape is compatible — `session.user` has the same fields.

**Files:**
- Modify: All API routes under `apps/web/app/api/`

**Step 1: Create a search-and-replace script**

The pattern is simple: replace `import { auth } from "@/lib/auth"` with `import { unifiedAuth } from "@/lib/unified-auth"` and `await auth()` with `await unifiedAuth()`.

However, doing this for all 56 routes at once is risky. Instead, start with the routes the MCP server needs most:

Priority routes to migrate:
1. `app/api/threads/route.ts` — list_threads
2. `app/api/threads/[id]/route.ts` — get_thread
3. `app/api/threads/[id]/status/route.ts` — update_thread_status
4. `app/api/threads/[id]/tags/route.ts` — tag management
5. `app/api/threads/batch/status/route.ts` — batch_update_status
6. `app/api/threads/[id]/delete/route.ts` — delete_thread
7. `app/api/emails/send/route.ts` — send_email
8. `app/api/tags/route.ts` — list_tags
9. `app/api/shared-drafts/route.ts` — list/create drafts
10. `app/api/shared-drafts/[id]/route.ts` — update draft
11. `app/api/threads/[id]/comments/route.ts` — comments
12. `app/api/threads/[id]/assignments/route.ts` — assignments
13. `app/api/ai/process/route.ts` — trigger AI
14. `app/api/ai/summary/route.ts` — AI summary
15. `app/api/agents/route.ts` — list agents
16. `app/api/contacts/[id]/trust/route.ts` — update trust
17. `app/api/mailboxes/route.ts` — list mailboxes
18. `app/api/sync/route.ts` — trigger sync
19. `app/api/notifications/route.ts` — list notifications
20. `app/api/notifications/[id]/route.ts` — mark read

For each file:
1. Change `import { auth } from "@/lib/auth"` → `import { unifiedAuth } from "@/lib/unified-auth"`
2. Change `const session = await auth()` → `const session = await unifiedAuth()`
3. The rest of the code works as-is because `session.user` shape is identical.

**Important:** Some routes import `auth` for additional purposes (e.g., `signIn`, `signOut`). Only change the import and call for routes that use `auth()` purely for session checking.

**Step 2: Verify the web app builds and tests pass**

Run: `cd apps/web && pnpm build && pnpm test`
Expected: Build succeeds, all tests pass.

**Step 3: Commit**

```bash
git add apps/web/app/api/
git commit -m "feat: migrate API routes to unified auth (session + API key)"
```

---

### Task 4: Create API key management routes

**Files:**
- Create: `apps/web/app/api/auth/api-keys/route.ts`
- Create: `apps/web/app/api/auth/api-keys/[id]/route.ts`

**Step 1: Create the list + create route**

Create `apps/web/app/api/auth/api-keys/route.ts`:

```typescript
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
```

**Step 2: Create the delete route**

Create `apps/web/app/api/auth/api-keys/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// DELETE: Revoke an API key
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Ensure the key belongs to the current user
  const key = await prisma.apiKey.findFirst({
    where: { id, userId: session.user.id as string },
  });

  if (!key) {
    return NextResponse.json({ error: "API key not found" }, { status: 404 });
  }

  await prisma.apiKey.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
```

**Step 3: Verify build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add apps/web/app/api/auth/api-keys/
git commit -m "feat: add API key management routes (create, list, delete)"
```

---

### Task 5: Add missing API routes needed by MCP

**Files:**
- Create: `apps/web/app/api/emails/[id]/route.ts`
- Create: `apps/web/app/api/contacts/route.ts`

**Step 1: Create single email fetch route**

Create `apps/web/app/api/emails/[id]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { unifiedAuth } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await unifiedAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const email = await prisma.email.findUnique({
    where: { id },
    include: {
      attachments: {
        select: { id: true, filename: true, contentType: true, size: true },
      },
      thread: {
        select: {
          id: true,
          mailboxId: true,
          subject: true,
        },
      },
    },
  });

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  // Verify mailbox access
  const hasAccess = await prisma.mailboxAccess.findFirst({
    where: { userId: session.user.id, mailboxId: email.thread.mailboxId },
  });

  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ email });
}
```

**Step 2: Create contacts list route**

Create `apps/web/app/api/contacts/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { unifiedAuth } from "@/lib/unified-auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await unifiedAuth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const trustLevel = searchParams.get("trustLevel");
  const search = searchParams.get("search");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 200);
  const cursor = searchParams.get("cursor");

  const where: Record<string, unknown> = {
    teamId: session.user.teamId,
  };

  if (trustLevel) {
    where.trustLevel = trustLevel;
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: "insensitive" } },
      { name: { contains: search, mode: "insensitive" } },
      { company: { contains: search, mode: "insensitive" } },
    ];
  }

  const contacts = await prisma.contact.findMany({
    where,
    orderBy: { lastSeenAt: "desc" },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    select: {
      id: true,
      email: true,
      name: true,
      company: true,
      domain: true,
      trustLevel: true,
      interactionCount: true,
      repliedToCount: true,
      lastSeenAt: true,
    },
  });

  const hasNextPage = contacts.length > limit;
  const results = hasNextPage ? contacts.slice(0, limit) : contacts;

  return NextResponse.json({
    contacts: results,
    pagination: {
      hasNextPage,
      nextCursor: hasNextPage ? results[results.length - 1]?.id : null,
      limit,
    },
  });
}
```

**Step 3: Verify build**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds.

**Step 4: Commit**

```bash
git add apps/web/app/api/emails/[id]/ apps/web/app/api/contacts/
git commit -m "feat: add single email and contacts list API routes for MCP"
```

---

## Phase 2: MCP Server Package

### Task 6: Scaffold the MCP server package

**Files:**
- Create: `packages/mcp-server/package.json`
- Create: `packages/mcp-server/tsconfig.json`
- Create: `packages/mcp-server/src/index.ts` (placeholder)

**Step 1: Create package.json**

Create `packages/mcp-server/package.json`:

```json
{
  "name": "@emaily/mcp-server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "@emaily/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.3",
    "@types/node": "^22.16.0"
  }
}
```

**Step 2: Create tsconfig.json**

Create `packages/mcp-server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create placeholder index.ts**

Create `packages/mcp-server/src/index.ts`:

```typescript
#!/usr/bin/env node
console.log("@emaily/mcp-server placeholder");
```

**Step 4: Install dependencies**

Run: `cd /path/to/Emaily && pnpm install`
Expected: Dependencies installed, workspace linked.

**Step 5: Verify build**

Run: `cd packages/mcp-server && pnpm build`
Expected: TypeScript compiles, `dist/index.js` created.

**Step 6: Commit**

```bash
git add packages/mcp-server/
git commit -m "feat: scaffold MCP server package"
```

---

### Task 7: Implement config and HTTP client

**Files:**
- Create: `packages/mcp-server/src/config.ts`
- Create: `packages/mcp-server/src/client.ts`

**Step 1: Create config loader**

Create `packages/mcp-server/src/config.ts`:

```typescript
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { homedir } from "os";

export interface McpConfig {
  apiKey: string;
  baseUrl: string;
}

export function loadConfig(): McpConfig {
  // 1. Environment variables (highest priority)
  const envKey = process.env.EMAILY_API_KEY;
  const envUrl = process.env.EMAILY_BASE_URL;

  if (envKey) {
    return {
      apiKey: envKey,
      baseUrl: envUrl || "http://localhost:3000",
    };
  }

  // 2. Config file
  const configPath = join(homedir(), ".emaily-mcp.json");
  if (existsSync(configPath)) {
    const raw = readFileSync(configPath, "utf-8");
    const config = JSON.parse(raw);
    if (config.apiKey) {
      return {
        apiKey: config.apiKey,
        baseUrl: config.baseUrl || "http://localhost:3000",
      };
    }
  }

  throw new Error(
    "Missing EMAILY_API_KEY. Set it as an environment variable or in ~/.emaily-mcp.json"
  );
}
```

**Step 2: Create HTTP client**

Create `packages/mcp-server/src/client.ts`:

```typescript
import type { McpConfig } from "./config.js";

export class EmailyClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(config: McpConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.apiKey = config.apiKey;
  }

  async get<T = unknown>(path: string, params?: Record<string, string | undefined>): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined) url.searchParams.set(key, value);
      }
    }
    return this.request<T>(url.toString(), { method: "GET" });
  }

  async post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T = unknown>(path: string): Promise<T> {
    return this.request<T>(`${this.baseUrl}${path}`, { method: "DELETE" });
  }

  private async request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        ...init.headers as Record<string, string>,
        Authorization: `Bearer ${this.apiKey}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      let message: string;
      try {
        const parsed = JSON.parse(errorBody);
        message = parsed.error || parsed.message || errorBody;
      } catch {
        message = errorBody;
      }

      throw new McpHttpError(response.status, message);
    }

    return response.json() as Promise<T>;
  }
}

export class McpHttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "McpHttpError";
  }
}
```

**Step 3: Verify build**

Run: `cd packages/mcp-server && pnpm build`
Expected: Compiles without errors.

**Step 4: Commit**

```bash
git add packages/mcp-server/src/config.ts packages/mcp-server/src/client.ts
git commit -m "feat: add MCP server config loader and HTTP client"
```

---

### Task 8: Implement MCP server entry point with tool registration

**Files:**
- Modify: `packages/mcp-server/src/index.ts`
- Create: `packages/mcp-server/src/tools/index.ts`

**Step 1: Create tool registry**

Create `packages/mcp-server/src/tools/index.ts`:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EmailyClient } from "../client.js";

export type ToolRegistrar = (server: McpServer, client: EmailyClient) => void;

// Import and re-export all tool modules
// Each module registers its own tools with the server
import { registerThreadTools } from "./threads.js";
import { registerEmailTools } from "./email.js";
import { registerTagTools } from "./tags.js";
import { registerDraftTools } from "./drafts.js";
import { registerContactTools } from "./contacts.js";
import { registerAssignmentTools } from "./assignments.js";
import { registerCommentTools } from "./comments.js";
import { registerAiTools } from "./ai.js";
import { registerMailboxTools } from "./mailboxes.js";
import { registerNotificationTools } from "./notifications.js";
import { registerSyncTools } from "./sync.js";

export function registerAllTools(server: McpServer, client: EmailyClient): void {
  registerThreadTools(server, client);
  registerEmailTools(server, client);
  registerTagTools(server, client);
  registerDraftTools(server, client);
  registerContactTools(server, client);
  registerAssignmentTools(server, client);
  registerCommentTools(server, client);
  registerAiTools(server, client);
  registerMailboxTools(server, client);
  registerNotificationTools(server, client);
  registerSyncTools(server, client);
}
```

**Step 2: Implement the server entry point**

Replace `packages/mcp-server/src/index.ts`:

```typescript
#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadConfig } from "./config.js";
import { EmailyClient } from "./client.js";
import { registerAllTools } from "./tools/index.js";

async function main() {
  const config = loadConfig();
  const client = new EmailyClient(config);

  const server = new McpServer({
    name: "emaily",
    version: "0.1.0",
  });

  registerAllTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with MCP stdio protocol
  console.error("Emaily MCP server started");
}

main().catch((error) => {
  console.error("Failed to start Emaily MCP server:", error.message);
  process.exit(1);
});
```

**Note:** Don't build yet — the tool modules don't exist. We'll create stub files first.

**Step 3: Create stub tool files**

Create each tool file with an empty registration function so the project compiles. All tool files follow this pattern:

For each of these files: `threads.ts`, `email.ts`, `tags.ts`, `drafts.ts`, `contacts.ts`, `assignments.ts`, `comments.ts`, `ai.ts`, `mailboxes.ts`, `notifications.ts`, `sync.ts`

Create in `packages/mcp-server/src/tools/`:

```typescript
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EmailyClient } from "../client.js";

export function registerXxxTools(server: McpServer, client: EmailyClient): void {
  // Tools will be registered here
}
```

(Replace `registerXxxTools` with the correct name for each file.)

**Step 4: Verify build**

Run: `cd packages/mcp-server && pnpm build`
Expected: Compiles without errors.

**Step 5: Commit**

```bash
git add packages/mcp-server/src/
git commit -m "feat: add MCP server entry point and tool registry"
```

---

### Task 9: Implement thread tools

**Files:**
- Modify: `packages/mcp-server/src/tools/threads.ts`

**Step 1: Implement all thread tools**

Replace `packages/mcp-server/src/tools/threads.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerThreadTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_threads",
    "List email threads with optional filtering by status, mailbox, tag, or search query. Returns paginated results.",
    {
      status: z.enum(["open", "archived", "snoozed", "quarantined", "trashed", "all"]).optional()
        .describe("Filter by thread status. Defaults to 'open' (inbox)."),
      mailboxId: z.string().optional().describe("Filter by mailbox ID"),
      tagId: z.string().optional().describe("Filter by tag ID"),
      search: z.string().optional().describe("Full-text search query (min 2 chars)"),
      filter: z.enum(["unprocessed", "sent"]).optional().describe("Special filter: 'unprocessed' for AI-unprocessed threads, 'sent' for threads with sent replies"),
      limit: z.number().min(1).max(100).optional().describe("Results per page (default 20, max 100)"),
      cursor: z.string().optional().describe("Pagination cursor from previous response"),
    },
    async (params) => {
      const data = await client.get<{ threads: unknown[]; pagination: unknown }>("/api/threads", {
        status: params.status,
        mailboxId: params.mailboxId,
        tagId: params.tagId,
        q: params.search,
        filter: params.filter,
        limit: params.limit?.toString(),
        cursor: params.cursor,
      });

      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "get_thread",
    "Get a single thread with all its emails, tags, assignments, and comments. Use this to read the full conversation.",
    {
      threadId: z.string().describe("The thread ID to retrieve"),
    },
    async ({ threadId }) => {
      const data = await client.get(`/api/threads/${threadId}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "update_thread_status",
    "Change a thread's status: archive, snooze, trash, or reopen it.",
    {
      threadId: z.string().describe("The thread ID to update"),
      status: z.enum(["open", "archived", "snoozed", "trashed"]).describe("New status"),
    },
    async ({ threadId, status }) => {
      const data = await client.patch(`/api/threads/${threadId}/status`, { status });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "batch_update_status",
    "Change status of multiple threads at once.",
    {
      threadIds: z.array(z.string()).min(1).describe("Array of thread IDs"),
      status: z.enum(["open", "archived", "snoozed", "trashed"]).describe("New status for all threads"),
    },
    async ({ threadIds, status }) => {
      const data = await client.post("/api/threads/batch/status", { threadIds, status });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "delete_thread",
    "Move a thread to trash.",
    {
      threadId: z.string().describe("The thread ID to delete"),
    },
    async ({ threadId }) => {
      const data = await client.delete(`/api/threads/${threadId}/delete`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

**Step 2: Verify build**

Run: `cd packages/mcp-server && pnpm build`
Expected: Compiles without errors.

**Step 3: Commit**

```bash
git add packages/mcp-server/src/tools/threads.ts
git commit -m "feat: implement MCP thread tools (list, get, status, batch, delete)"
```

---

### Task 10: Implement email, tag, and draft tools

**Files:**
- Modify: `packages/mcp-server/src/tools/email.ts`
- Modify: `packages/mcp-server/src/tools/tags.ts`
- Modify: `packages/mcp-server/src/tools/drafts.ts`

**Step 1: Implement email tools**

Replace `packages/mcp-server/src/tools/email.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerEmailTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "get_email",
    "Get a single email's full content including body, headers, and attachments.",
    {
      emailId: z.string().describe("The email ID to retrieve"),
    },
    async ({ emailId }) => {
      const data = await client.get(`/api/emails/${emailId}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "send_email",
    "Send an email from a mailbox. Can be a new email or a reply to an existing thread.",
    {
      mailboxId: z.string().describe("The mailbox ID to send from"),
      to: z.string().describe("Recipient email address"),
      subject: z.string().describe("Email subject line"),
      body: z.string().describe("Email body (plain text)"),
      inReplyTo: z.string().optional().describe("Message ID to reply to (for threading)"),
      cc: z.string().optional().describe("CC recipients (comma-separated)"),
    },
    async (params) => {
      const data = await client.post("/api/emails/send", params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

**Step 2: Implement tag tools**

Replace `packages/mcp-server/src/tools/tags.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerTagTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_tags",
    "List all available tags for the team. Tags can have AI actions (auto-draft, auto-reply, archive, quarantine, notify).",
    {},
    async () => {
      const data = await client.get("/api/tags");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "add_tag_to_thread",
    "Add a tag to a thread. Some tags trigger AI actions (e.g., 'Spam' quarantines the thread).",
    {
      threadId: z.string().describe("The thread ID"),
      tagId: z.string().describe("The tag ID to add"),
    },
    async ({ threadId, tagId }) => {
      const data = await client.post(`/api/threads/${threadId}/tags`, { tagId });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "remove_tag_from_thread",
    "Remove a tag from a thread.",
    {
      threadId: z.string().describe("The thread ID"),
      tagId: z.string().describe("The tag ID to remove"),
    },
    async ({ threadId, tagId }) => {
      const data = await client.delete(`/api/threads/${threadId}/tags?tagId=${tagId}`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

**Step 3: Implement draft tools**

Replace `packages/mcp-server/src/tools/drafts.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerDraftTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_drafts",
    "List shared drafts. Can filter by status (drafting, ready_for_review, sent).",
    {
      status: z.enum(["drafting", "ready_for_review", "sent"]).optional()
        .describe("Filter by draft status"),
    },
    async (params) => {
      const data = await client.get("/api/shared-drafts", {
        status: params.status,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "create_draft",
    "Create a shared draft reply for a thread. Other team members can review and edit before sending.",
    {
      threadId: z.string().describe("The thread to reply to"),
      mailboxId: z.string().describe("The mailbox to send from"),
      subject: z.string().optional().describe("Draft subject (defaults to Re: thread subject)"),
      body: z.string().describe("Draft body text"),
    },
    async (params) => {
      const data = await client.post("/api/shared-drafts", params);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "update_draft",
    "Update a shared draft's body or status.",
    {
      draftId: z.string().describe("The draft ID to update"),
      body: z.string().optional().describe("Updated draft body"),
      status: z.enum(["drafting", "ready_for_review"]).optional()
        .describe("Updated draft status"),
    },
    async ({ draftId, ...updates }) => {
      const data = await client.patch(`/api/shared-drafts/${draftId}`, updates);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

**Step 4: Verify build**

Run: `cd packages/mcp-server && pnpm build`
Expected: Compiles without errors.

**Step 5: Commit**

```bash
git add packages/mcp-server/src/tools/email.ts packages/mcp-server/src/tools/tags.ts packages/mcp-server/src/tools/drafts.ts
git commit -m "feat: implement MCP email, tag, and draft tools"
```

---

### Task 11: Implement collaboration, AI, and remaining tools

**Files:**
- Modify: `packages/mcp-server/src/tools/contacts.ts`
- Modify: `packages/mcp-server/src/tools/assignments.ts`
- Modify: `packages/mcp-server/src/tools/comments.ts`
- Modify: `packages/mcp-server/src/tools/ai.ts`
- Modify: `packages/mcp-server/src/tools/mailboxes.ts`
- Modify: `packages/mcp-server/src/tools/notifications.ts`
- Modify: `packages/mcp-server/src/tools/sync.ts`

**Step 1: Implement contacts tools**

```typescript
// packages/mcp-server/src/tools/contacts.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerContactTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_contacts",
    "List contacts with trust levels. Filter by trust level or search by name/email.",
    {
      trustLevel: z.enum(["stranger", "known", "trusted", "vip"]).optional()
        .describe("Filter by trust level"),
      search: z.string().optional().describe("Search by name, email, or company"),
      limit: z.number().min(1).max(200).optional().describe("Results per page (default 50)"),
      cursor: z.string().optional().describe("Pagination cursor"),
    },
    async (params) => {
      const data = await client.get("/api/contacts", {
        trustLevel: params.trustLevel,
        search: params.search,
        limit: params.limit?.toString(),
        cursor: params.cursor,
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "update_contact_trust",
    "Change a contact's trust level. Trust levels affect AI processing: strangers get quarantined, VIPs get priority.",
    {
      contactId: z.string().describe("The contact ID"),
      trustLevel: z.enum(["stranger", "known", "trusted", "vip"]).describe("New trust level"),
    },
    async ({ contactId, trustLevel }) => {
      const data = await client.post(`/api/contacts/${contactId}/trust`, { trustLevel });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

**Step 2: Implement assignment tools**

```typescript
// packages/mcp-server/src/tools/assignments.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerAssignmentTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "create_assignment",
    "Assign a thread to a team member for follow-up.",
    {
      threadId: z.string().describe("The thread to assign"),
      assignedToId: z.string().describe("User ID of the assignee"),
      note: z.string().optional().describe("Note for the assignee"),
      dueDate: z.string().optional().describe("Due date (ISO 8601 format)"),
    },
    async ({ threadId, ...body }) => {
      const data = await client.post(`/api/threads/${threadId}/assignments`, body);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

**Step 3: Implement comment tools**

```typescript
// packages/mcp-server/src/tools/comments.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerCommentTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "add_comment",
    "Add an internal comment to a thread. Comments are visible to team members only, not sent to external recipients.",
    {
      threadId: z.string().describe("The thread to comment on"),
      content: z.string().describe("Comment text"),
    },
    async ({ threadId, content }) => {
      const data = await client.post(`/api/threads/${threadId}/comments`, { content });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "list_comments",
    "Get all internal comments on a thread.",
    {
      threadId: z.string().describe("The thread ID"),
    },
    async ({ threadId }) => {
      const data = await client.get(`/api/threads/${threadId}/comments`);
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

**Step 4: Implement AI tools**

```typescript
// packages/mcp-server/src/tools/ai.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerAiTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "trigger_ai_processing",
    "Trigger AI processing on a thread. AI will classify, tag, extract intents, and optionally generate a draft reply.",
    {
      threadId: z.string().describe("The thread ID to process"),
    },
    async ({ threadId }) => {
      const data = await client.post("/api/ai/process", { threadId });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "get_ai_summary",
    "Get an AI-generated summary of recent inbox activity including new threads, AI actions taken, and items needing attention.",
    {
      hours: z.number().min(1).max(168).optional()
        .describe("Number of hours to look back (default 24, max 168 = 1 week)"),
    },
    async (params) => {
      const data = await client.get("/api/ai/summary", {
        hours: params.hours?.toString(),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "list_agents",
    "List available AI agents. Each agent has a personality, system prompt, and can be specialized for certain tag categories.",
    {},
    async () => {
      const data = await client.get("/api/agents");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

**Step 5: Implement mailbox, notification, and sync tools**

```typescript
// packages/mcp-server/src/tools/mailboxes.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EmailyClient } from "../client.js";

export function registerMailboxTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_mailboxes",
    "List all mailboxes the current user has access to, including connection status.",
    {},
    async () => {
      const data = await client.get("/api/mailboxes");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

```typescript
// packages/mcp-server/src/tools/notifications.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerNotificationTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_notifications",
    "List notifications (AI alerts, assignments, mentions, invites).",
    {
      unreadOnly: z.boolean().optional().describe("Only return unread notifications"),
    },
    async (params) => {
      const data = await client.get("/api/notifications", {
        unreadOnly: params.unreadOnly?.toString(),
      });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );

  server.tool(
    "mark_notification_read",
    "Mark a notification as read.",
    {
      notificationId: z.string().describe("The notification ID"),
    },
    async ({ notificationId }) => {
      const data = await client.patch(`/api/notifications/${notificationId}`, { read: true });
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

```typescript
// packages/mcp-server/src/tools/sync.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { EmailyClient } from "../client.js";

export function registerSyncTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "trigger_sync",
    "Trigger an IMAP sync for all accessible mailboxes. Fetches new emails from the mail server.",
    {},
    async () => {
      const data = await client.post("/api/sync");
      return {
        content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
      };
    }
  );
}
```

**Step 6: Verify build**

Run: `cd packages/mcp-server && pnpm build`
Expected: All tools compile, full build succeeds.

**Step 7: Commit**

```bash
git add packages/mcp-server/src/tools/
git commit -m "feat: implement all remaining MCP tools (contacts, assignments, comments, AI, mailboxes, notifications, sync)"
```

---

## Phase 3: MCP Error Handling

### Task 12: Add error mapping to MCP tools

**Files:**
- Modify: `packages/mcp-server/src/index.ts`
- Modify: `packages/mcp-server/src/client.ts` (already has McpHttpError)

The `McpHttpError` already exists in the client. The MCP SDK automatically catches thrown errors and returns them as MCP error responses. However, we should add a wrapper for better error messages.

**Step 1: Add a tool error helper**

Create `packages/mcp-server/src/errors.ts`:

```typescript
import { McpHttpError } from "./client.js";

export function formatToolError(error: unknown): string {
  if (error instanceof McpHttpError) {
    switch (error.status) {
      case 401:
        return `Authentication failed: ${error.message}. Check your EMAILY_API_KEY.`;
      case 403:
        return `Permission denied: ${error.message}`;
      case 404:
        return `Not found: ${error.message}`;
      case 429:
        return `Rate limited: ${error.message}. Try again later.`;
      default:
        return `API error (${error.status}): ${error.message}`;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
```

The MCP SDK's `server.tool()` handler already wraps errors into `McpError` responses. Since our `McpHttpError` extends `Error`, the message is passed through automatically. The `formatToolError` helper can be used if we want to wrap tool handlers explicitly, but the default behavior is sufficient for v1.

**Step 2: Commit**

```bash
git add packages/mcp-server/src/errors.ts
git commit -m "feat: add MCP error formatting utility"
```

---

## Phase 4: Settings UI for API Key Management

### Task 13: Add API Keys settings page

**Files:**
- Create: `apps/web/app/(dashboard)/settings/api-keys/page.tsx`
- Modify: `apps/web/components/settings/settings-sidebar.tsx` (add nav link)

**Step 1: Add navigation link to settings sidebar**

In `apps/web/components/settings/settings-sidebar.tsx`, add an "API Keys" link to the navigation items list, using the `Key` icon from `lucide-react`. Place it after the existing entries (profile, preferences, team, mailboxes, agents, tags). The link should point to `/settings/api-keys`.

**Step 2: Create the API Keys settings page**

Create `apps/web/app/(dashboard)/settings/api-keys/page.tsx`:

This page should:
- Use the existing settings page layout pattern (card-based, consistent with profile/preferences pages)
- Fetch keys with SWR from `/api/auth/api-keys`
- Show a "Generate New Key" button that opens a dialog with:
  - Name input (required)
  - Scope selection (checkboxes, default to all)
  - Optional expiry date
- When key is created, show the raw key in a copiable field with a warning "Save this now"
- Show a "Claude Desktop Config" copy button that generates the JSON config snippet
- List existing keys in a table: name, prefix, scopes count, last used, created, revoke button
- Revoke button calls `DELETE /api/auth/api-keys/[id]` with confirmation

Follow the same patterns used in the profile page:
- `useState` for form state
- `fetch()` for mutations
- SWR `mutate()` for cache invalidation after create/delete
- Toast notifications for success/error
- Loading states with skeleton UI

**Step 3: Verify the page renders**

Run: `cd apps/web && pnpm dev`
Navigate to: `http://localhost:3000/settings/api-keys`
Expected: Page renders with empty state, generate button works.

**Step 4: Commit**

```bash
git add apps/web/app/(dashboard)/settings/api-keys/ apps/web/components/settings/settings-sidebar.tsx
git commit -m "feat: add API Keys settings page with key generation and management"
```

---

## Phase 5: Integration Testing & Documentation

### Task 14: End-to-end testing with Claude Desktop

**Step 1: Generate an API key**

1. Start the web app: `cd apps/web && pnpm dev`
2. Navigate to Settings > API Keys
3. Generate a new key with name "Claude Desktop" and all scopes
4. Copy the raw key

**Step 2: Build the MCP server**

Run: `cd packages/mcp-server && pnpm build`

**Step 3: Configure Claude Desktop**

Add to Claude Desktop config (`claude_desktop_config.json` or equivalent):

```json
{
  "mcpServers": {
    "emaily": {
      "command": "node",
      "args": ["C:/Users/Stephan/Documents/DEV/Emaily/packages/mcp-server/dist/index.js"],
      "env": {
        "EMAILY_API_KEY": "<the generated key>",
        "EMAILY_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

**Step 4: Test in Claude Desktop**

Verify these tools work:
- "List my email threads" → `list_threads`
- "Show me thread <id>" → `get_thread`
- "Archive thread <id>" → `update_thread_status`
- "List all tags" → `list_tags`
- "What mailboxes do I have?" → `list_mailboxes`
- "Trigger a sync" → `trigger_sync`

**Step 5: Fix any issues found**

Address errors in tool schemas, API mapping, or auth flow.

### Task 15: Add turbo pipeline entry and npm scripts

**Files:**
- Modify: `turbo.json` (if needed)
- Verify: `packages/mcp-server/package.json` scripts

**Step 1: Verify turbo picks up the new package**

Run: `pnpm build`
Expected: turbo builds `@emaily/mcp-server` along with other packages.

**Step 2: Add a convenience script to root package.json**

Optional: Add `"mcp:start": "node packages/mcp-server/dist/index.js"` to root `package.json` scripts.

**Step 3: Final commit**

```bash
git add .
git commit -m "feat: complete MCP server integration with build pipeline"
```

---

## Summary

| Phase | Tasks | What it delivers |
|-------|-------|------------------|
| 1: API Key Infrastructure | Tasks 1-5 | ApiKey model, auth middleware, unified auth, key management routes, missing API routes |
| 2: MCP Server Package | Tasks 6-11 | Package scaffold, config/client, entry point, all 25 MCP tools |
| 3: Error Handling | Task 12 | Friendly error messages for MCP clients |
| 4: Settings UI | Task 13 | API key generation and management in web UI |
| 5: Integration Testing | Tasks 14-15 | End-to-end verification with Claude Desktop |

**Total: 15 tasks across 5 phases.**

**Dependencies:** Phase 2 can start in parallel with Phase 1 (Tasks 6-8 don't depend on API key auth). Phase 3 depends on Phase 2. Phase 4 depends on Task 4. Phase 5 depends on everything.
