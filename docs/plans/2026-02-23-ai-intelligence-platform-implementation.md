# AI Email Intelligence Platform — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add persistent AI memory with commitment tracking, smart calendar feed, enhanced agent playbooks with collaboration/learning, and team routing features to Emaily.

**Architecture:** Extends existing `UnifiedThreadProcessor` pipeline with a commitment extraction step. New `Commitment` and `AgentAction` Prisma models. iCal feed via new API routes. Agent model extended with playbook fields. Corrections memory injected into agent prompts.

**Tech Stack:** Prisma 6, Next.js 15 API routes, iCal (ical-generator), Zod validation, existing AI pipeline (Gemini/Ollama), Vitest for tests.

---

## Phase 1: Commitment Extraction & Data Model

### Task 1: Add Commitment model to Prisma schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/shared/src/types/index.ts`

**Step 1: Add the Commitment model and enums to the Prisma schema**

Add after the `AiCorrection` model (around line 530):

```prisma
// Commitment tracking — AI-extracted promises, requests, and deadlines
model Commitment {
  id                String           @id @default(cuid())
  teamId            String           @map("team_id")
  userId            String           @map("user_id")
  threadId          String           @map("thread_id")
  emailId           String?          @map("email_id")
  contactId         String?          @map("contact_id")
  type              String           // outbound_promise | inbound_promise | open_request | mentioned_date | stale_thread
  direction         String           // inbound | outbound
  title             String           // user-friendly: "Send pricing proposal to John @ Acme"
  description       String           @default("")
  sourceQuote       String?          @map("source_quote")
  dueDate           DateTime?        @map("due_date")
  dueDateInferred   Boolean          @default(false) @map("due_date_inferred")
  status            String           @default("pending") // pending | fulfilled | overdue | dismissed | snoozed
  snoozeUntil       DateTime?        @map("snooze_until")
  fulfilledAt       DateTime?        @map("fulfilled_at")
  fulfilledByEmailId String?         @map("fulfilled_by_email_id")
  confidence        Float            @default(0.8)
  createdAt         DateTime         @default(now()) @map("created_at")
  updatedAt         DateTime         @updatedAt @map("updated_at")

  team              Team             @relation(fields: [teamId], references: [id], onDelete: Cascade)
  user              User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  thread            Thread           @relation(fields: [threadId], references: [id], onDelete: Cascade)
  email             Email?           @relation(fields: [emailId], references: [id], onDelete: SetNull)
  contact           Contact?         @relation(fields: [contactId], references: [id], onDelete: SetNull)

  @@index([teamId, userId, status])
  @@index([threadId])
  @@index([userId, dueDate])
  @@index([status, dueDate])
  @@map("commitments")
}
```

Add reverse relations:
- On `Team`: `commitments Commitment[]`
- On `User`: `commitments Commitment[]`
- On `Thread`: `commitments Commitment[]`
- On `Email`: `commitments Commitment[]`
- On `Contact`: `commitments Commitment[]`

**Step 2: Add shared types for commitments**

Add to `packages/shared/src/types/index.ts`:

```typescript
// Commitment types
export type CommitmentType = "outbound_promise" | "inbound_promise" | "open_request" | "mentioned_date" | "stale_thread";
export type CommitmentDirection = "inbound" | "outbound";
export type CommitmentStatus = "pending" | "fulfilled" | "overdue" | "dismissed" | "snoozed";

export interface Commitment {
  id: string;
  teamId: string;
  userId: string;
  threadId: string;
  emailId: string | null;
  contactId: string | null;
  type: CommitmentType;
  direction: CommitmentDirection;
  title: string;
  description: string;
  sourceQuote: string | null;
  dueDate: Date | null;
  dueDateInferred: boolean;
  status: CommitmentStatus;
  snoozeUntil: Date | null;
  fulfilledAt: Date | null;
  fulfilledByEmailId: string | null;
  confidence: number;
  createdAt: Date;
  updatedAt: Date;
}
```

Also add type guards to `packages/shared/src/guards.ts`:

```typescript
const VALID_COMMITMENT_TYPES = ["outbound_promise", "inbound_promise", "open_request", "mentioned_date", "stale_thread"] as const;
const VALID_COMMITMENT_STATUSES = ["pending", "fulfilled", "overdue", "dismissed", "snoozed"] as const;

export function isValidCommitmentType(s: string): s is CommitmentType {
  return (VALID_COMMITMENT_TYPES as readonly string[]).includes(s);
}

export function isValidCommitmentStatus(s: string): s is CommitmentStatus {
  return (VALID_COMMITMENT_STATUSES as readonly string[]).includes(s);
}
```

Re-export from `packages/shared/src/types/index.ts`.

**Step 3: Push schema to database**

Run: `cd packages/database && DATABASE_URL="postgresql://emaily:emaily@localhost:5432/emaily" npx prisma db push`
Expected: Schema pushed successfully, `commitments` table created.

**Step 4: Regenerate Prisma client**

Run: `cd packages/database && DATABASE_URL="postgresql://emaily:emaily@localhost:5432/emaily" npx prisma generate`
Expected: Prisma client generated with `Commitment` model.

**Step 5: Commit**

```bash
git add packages/database/prisma/schema.prisma packages/shared/src/types/index.ts packages/shared/src/guards.ts
git commit -m "feat: add Commitment model for AI email memory tracking"
```

---

### Task 2: Commitment extraction prompt

**Files:**
- Create: `packages/ai-engine/src/prompts/commitment-extraction.ts`
- Test: `packages/ai-engine/tests/commitment-extraction.test.ts`

**Step 1: Write the failing test**

```typescript
// packages/ai-engine/tests/commitment-extraction.test.ts
import { describe, it, expect } from "vitest";
import { buildCommitmentExtractionPrompt, parseCommitmentResponse, type CommitmentExtractionOptions } from "../src/prompts/commitment-extraction";

describe("buildCommitmentExtractionPrompt", () => {
  const baseOptions: CommitmentExtractionOptions = {
    threadSubject: "RE: Q1 Partnership Proposal",
    emails: [
      {
        from: "john@acme.com",
        to: ["you@company.com"],
        date: "2026-02-20T10:00:00Z",
        body: "Can you send me the pricing proposal by Friday?",
        isOutbound: false,
      },
      {
        from: "you@company.com",
        to: ["john@acme.com"],
        date: "2026-02-20T14:00:00Z",
        body: "Sure, I'll have the numbers to you by end of week. Also, could you send me the requirements doc?",
        isOutbound: true,
      },
    ],
    currentDate: "2026-02-23",
    userEmail: "you@company.com",
  };

  it("returns messages array with system and user roles", () => {
    const messages = buildCommitmentExtractionPrompt(baseOptions);
    expect(messages.length).toBe(2);
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
  });

  it("includes thread subject in user message", () => {
    const messages = buildCommitmentExtractionPrompt(baseOptions);
    expect(messages[1].content).toContain("Q1 Partnership Proposal");
  });

  it("includes current date for deadline inference", () => {
    const messages = buildCommitmentExtractionPrompt(baseOptions);
    expect(messages[0].content).toContain("2026-02-23");
  });

  it("includes all emails in user message", () => {
    const messages = buildCommitmentExtractionPrompt(baseOptions);
    expect(messages[1].content).toContain("john@acme.com");
    expect(messages[1].content).toContain("pricing proposal");
  });
});

describe("parseCommitmentResponse", () => {
  it("parses valid commitment array", () => {
    const json = JSON.stringify({
      commitments: [
        {
          type: "outbound_promise",
          direction: "outbound",
          title: "Send pricing proposal to John @ Acme",
          description: "Promised to send pricing numbers by end of week",
          sourceQuote: "I'll have the numbers to you by end of week",
          dueDate: "2026-02-27",
          confidence: 0.95,
        },
      ],
    });
    const result = parseCommitmentResponse(json);
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("outbound_promise");
    expect(result[0].title).toContain("pricing proposal");
  });

  it("filters out low-confidence commitments", () => {
    const json = JSON.stringify({
      commitments: [
        { type: "outbound_promise", direction: "outbound", title: "A", description: "", confidence: 0.9 },
        { type: "inbound_promise", direction: "inbound", title: "B", description: "", confidence: 0.3 },
      ],
    });
    const result = parseCommitmentResponse(json);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("A");
  });

  it("returns empty array for invalid JSON", () => {
    const result = parseCommitmentResponse("not json {{{");
    expect(result).toEqual([]);
  });

  it("returns empty array when commitments field is missing", () => {
    const result = parseCommitmentResponse(JSON.stringify({ tags: [] }));
    expect(result).toEqual([]);
  });

  it("filters out invalid commitment types", () => {
    const json = JSON.stringify({
      commitments: [
        { type: "invalid_type", direction: "outbound", title: "X", description: "", confidence: 0.9 },
        { type: "open_request", direction: "inbound", title: "Y", description: "", confidence: 0.9 },
      ],
    });
    const result = parseCommitmentResponse(json);
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Y");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/ai-engine && pnpm test -- tests/commitment-extraction.test.ts`
Expected: FAIL — module not found.

**Step 3: Write the implementation**

```typescript
// packages/ai-engine/src/prompts/commitment-extraction.ts
import type { CommitmentType, CommitmentDirection } from "@emaily/shared";

export interface CommitmentEmail {
  from: string;
  to: string[];
  date: string;
  body: string;
  isOutbound: boolean;
}

export interface CommitmentExtractionOptions {
  threadSubject: string;
  emails: CommitmentEmail[];
  currentDate: string;
  userEmail: string;
}

export interface ExtractedCommitment {
  type: CommitmentType;
  direction: CommitmentDirection;
  title: string;
  description: string;
  sourceQuote?: string;
  dueDate?: string;
  confidence: number;
}

const VALID_TYPES: CommitmentType[] = ["outbound_promise", "inbound_promise", "open_request", "mentioned_date", "stale_thread"];
const VALID_DIRECTIONS: CommitmentDirection[] = ["inbound", "outbound"];
const MIN_CONFIDENCE = 0.5;

export function buildCommitmentExtractionPrompt(options: CommitmentExtractionOptions): { role: string; content: string }[] {
  const { threadSubject, emails, currentDate, userEmail } = options;

  const systemPrompt = `You extract commitments, promises, deadlines, and open requests from email threads.

Today's date: ${currentDate}
User's email: ${userEmail}

For each commitment found, return a JSON object with:
- type: one of "outbound_promise" (user promised something), "inbound_promise" (someone promised the user), "open_request" (unanswered question/request to the user), "mentioned_date" (date/deadline mentioned), "stale_thread" (conversation died with unresolved items)
- direction: "outbound" (user → them) or "inbound" (them → user)
- title: clear, user-friendly summary (e.g., "Send pricing proposal to John @ Acme"). Max 80 chars.
- description: context about the commitment. 1-2 sentences.
- sourceQuote: exact text from the email that contains the commitment (if identifiable)
- dueDate: ISO date string (YYYY-MM-DD) if a deadline is stated or can be inferred. Infer "by end of week" as the upcoming Friday, "soon" as 3 business days, "next week" as Monday. Omit if truly unknown.
- confidence: 0.0-1.0 how confident you are this is a real commitment

Return JSON: { "commitments": [...] }
Return { "commitments": [] } if no commitments found.`;

  const emailsText = emails
    .map((e) => {
      const dir = e.isOutbound ? "[OUTBOUND]" : "[INBOUND]";
      return `${dir} From: ${e.from} → To: ${e.to.join(", ")} | Date: ${e.date}\n${e.body}`;
    })
    .join("\n\n---\n\n");

  const userMessage = `Thread: "${threadSubject}"\n\n${emailsText}`;

  return [
    { role: "system", content: systemPrompt },
    { role: "user", content: userMessage },
  ];
}

export function parseCommitmentResponse(raw: string): ExtractedCommitment[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object" || !("commitments" in parsed)) {
    return [];
  }

  const obj = parsed as { commitments: unknown };
  if (!Array.isArray(obj.commitments)) {
    return [];
  }

  return obj.commitments.filter((c: unknown): c is ExtractedCommitment => {
    if (!c || typeof c !== "object") return false;
    const item = c as Record<string, unknown>;
    if (typeof item.type !== "string" || !VALID_TYPES.includes(item.type as CommitmentType)) return false;
    if (typeof item.direction !== "string" || !VALID_DIRECTIONS.includes(item.direction as CommitmentDirection)) return false;
    if (typeof item.title !== "string" || !item.title.trim()) return false;
    if (typeof item.confidence !== "number" || item.confidence < MIN_CONFIDENCE) return false;
    return true;
  });
}
```

**Step 4: Run test to verify it passes**

Run: `cd packages/ai-engine && pnpm test -- tests/commitment-extraction.test.ts`
Expected: All tests pass.

**Step 5: Commit**

```bash
git add packages/ai-engine/src/prompts/commitment-extraction.ts packages/ai-engine/tests/commitment-extraction.test.ts
git commit -m "feat: add commitment extraction prompt and parser"
```

---

### Task 3: Integrate commitment extraction into the AI pipeline

**Files:**
- Modify: `packages/ai-engine/src/pipeline/unified-thread-processor.ts`
- Modify: `packages/shared/src/types/index.ts` (extend `UnifiedAIResult`)

**Step 1: Extend UnifiedAIResult with commitments**

In `packages/shared/src/types/index.ts`, modify the `UnifiedAIResult` interface:

```typescript
export interface UnifiedAIResult {
  tags: { name: string; confidence: number }[];
  intents: EmailIntent[];
  draft: {
    subject: string;
    body: string;
    confidence: DraftConfidence;
  } | null;
  commitments: {
    type: CommitmentType;
    direction: CommitmentDirection;
    title: string;
    description: string;
    sourceQuote?: string;
    dueDate?: string;
    confidence: number;
  }[];
}
```

**Step 2: Add commitment extraction to UnifiedThreadProcessor**

In `unified-thread-processor.ts`, after the existing `processThread()` call that extracts tags/intents/draft, add a second LLM call for commitment extraction:

- Import `buildCommitmentExtractionPrompt` and `parseCommitmentResponse`
- After the main processing, build commitment prompt from the thread emails
- Call the provider with the commitment prompt
- Parse and validate the response
- Merge commitments into the `UnifiedAIResult`

The commitment extraction is a separate LLM call because it has different system instructions than tagging/intents. This keeps the main prompt focused and the commitment prompt specialized.

**Step 3: Run existing tests to verify nothing breaks**

Run: `cd packages/ai-engine && pnpm test`
Expected: All 83 existing tests pass + commitment tests pass.

**Step 4: Commit**

```bash
git add packages/ai-engine/src/pipeline/unified-thread-processor.ts packages/shared/src/types/index.ts
git commit -m "feat: integrate commitment extraction into AI pipeline"
```

---

### Task 4: Commitment API routes

**Files:**
- Create: `apps/web/app/api/commitments/route.ts`
- Create: `apps/web/app/api/commitments/[id]/route.ts`
- Create: `apps/web/app/api/commitments/nudges/route.ts`

**Step 1: Create the commitments list/create route**

```typescript
// apps/web/app/api/commitments/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@emaily/database";
import { unifiedAuth } from "@/lib/unified-auth";

export async function GET(req: Request) {
  const session = await unifiedAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // pending | fulfilled | overdue | dismissed | snoozed
  const type = searchParams.get("type"); // commitment type filter
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
  const cursor = searchParams.get("cursor");

  const where: Record<string, unknown> = {
    teamId: session.user.teamId,
    userId: session.user.id,
  };
  if (status) where.status = status;
  if (type) where.type = type;

  const commitments = await prisma.commitment.findMany({
    where,
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      thread: { select: { id: true, subject: true } },
      contact: { select: { id: true, name: true, email: true } },
    },
  });

  const hasMore = commitments.length > limit;
  const results = hasMore ? commitments.slice(0, limit) : commitments;

  return NextResponse.json({
    commitments: results,
    hasMore,
    nextCursor: hasMore ? results[results.length - 1].id : null,
  });
}
```

**Step 2: Create the single commitment route (PATCH for status updates)**

```typescript
// apps/web/app/api/commitments/[id]/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@emaily/database";
import { unifiedAuth } from "@/lib/unified-auth";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await unifiedAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const commitment = await prisma.commitment.findFirst({
    where: { id, teamId: session.user.teamId },
    include: {
      thread: { select: { id: true, subject: true, status: true } },
      contact: { select: { id: true, name: true, email: true, trustLevel: true } },
      email: { select: { id: true, from: true, date: true, bodyText: true } },
    },
  });

  if (!commitment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(commitment);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await unifiedAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();

  const commitment = await prisma.commitment.findFirst({
    where: { id, teamId: session.user.teamId },
  });
  if (!commitment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updateData: Record<string, unknown> = {};
  if (body.status) {
    updateData.status = body.status;
    if (body.status === "fulfilled") updateData.fulfilledAt = new Date();
    if (body.status === "snoozed" && body.snoozeUntil) updateData.snoozeUntil = new Date(body.snoozeUntil);
  }
  if (body.dueDate !== undefined) updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;

  const updated = await prisma.commitment.update({ where: { id }, data: updateData });
  return NextResponse.json(updated);
}
```

**Step 3: Create the nudges endpoint**

```typescript
// apps/web/app/api/commitments/nudges/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@emaily/database";
import { unifiedAuth } from "@/lib/unified-auth";

export async function GET() {
  const session = await unifiedAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Overdue commitments
  const overdue = await prisma.commitment.findMany({
    where: {
      userId: session.user.id,
      status: "pending",
      dueDate: { lt: now },
    },
    include: { thread: { select: { id: true, subject: true } }, contact: { select: { name: true, email: true } } },
    orderBy: { dueDate: "asc" },
    take: 20,
  });

  // Upcoming (due within 3 days)
  const upcoming = await prisma.commitment.findMany({
    where: {
      userId: session.user.id,
      status: "pending",
      dueDate: { gte: now, lte: threeDaysFromNow },
    },
    include: { thread: { select: { id: true, subject: true } }, contact: { select: { name: true, email: true } } },
    orderBy: { dueDate: "asc" },
    take: 20,
  });

  // Stale (no due date, older than 7 days, still pending)
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const stale = await prisma.commitment.findMany({
    where: {
      userId: session.user.id,
      status: "pending",
      dueDate: null,
      createdAt: { lt: sevenDaysAgo },
    },
    include: { thread: { select: { id: true, subject: true } }, contact: { select: { name: true, email: true } } },
    orderBy: { createdAt: "asc" },
    take: 10,
  });

  // Snoozed that are now due
  const snoozedDue = await prisma.commitment.findMany({
    where: {
      userId: session.user.id,
      status: "snoozed",
      snoozeUntil: { lte: now },
    },
    include: { thread: { select: { id: true, subject: true } }, contact: { select: { name: true, email: true } } },
    take: 10,
  });

  return NextResponse.json({
    overdue,
    upcoming,
    stale,
    snoozedDue,
    totalNudges: overdue.length + upcoming.length + stale.length + snoozedDue.length,
  });
}
```

**Step 4: Commit**

```bash
git add apps/web/app/api/commitments/
git commit -m "feat: add commitment API routes (list, get, update, nudges)"
```

---

### Task 5: iCal calendar feed

**Files:**
- Create: `apps/web/app/api/calendar/[token]/feed.ics/route.ts`
- Create: `apps/web/app/api/calendar/generate-token/route.ts`
- Modify: `packages/database/prisma/schema.prisma` (add CalendarFeedToken model)

**Step 1: Add CalendarFeedToken model**

```prisma
model CalendarFeedToken {
  id        String   @id @default(cuid())
  token     String   @unique
  userId    String   @map("user_id")
  teamId    String   @map("team_id")
  active    Boolean  @default(true)
  createdAt DateTime @default(now()) @map("created_at")

  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  team      Team     @relation(fields: [teamId], references: [id], onDelete: Cascade)

  @@index([token])
  @@map("calendar_feed_tokens")
}
```

Add reverse relations on User and Team.

**Step 2: Install ical-generator**

Run: `cd apps/web && pnpm add ical-generator`

**Step 3: Create the token generation route**

```typescript
// apps/web/app/api/calendar/generate-token/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@emaily/database";
import { unifiedAuth } from "@/lib/unified-auth";
import { randomBytes } from "crypto";

export async function POST() {
  const session = await unifiedAuth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Deactivate existing tokens
  await prisma.calendarFeedToken.updateMany({
    where: { userId: session.user.id },
    data: { active: false },
  });

  const token = randomBytes(32).toString("hex");
  await prisma.calendarFeedToken.create({
    data: {
      token,
      userId: session.user.id,
      teamId: session.user.teamId,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const feedUrl = `${baseUrl}/api/calendar/${token}/feed.ics`;

  return NextResponse.json({ feedUrl, token });
}
```

**Step 4: Create the iCal feed route**

```typescript
// apps/web/app/api/calendar/[token]/feed.ics/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@emaily/database";
import ical, { ICalCalendarMethod, ICalEventStatus } from "ical-generator";

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const feedToken = await prisma.calendarFeedToken.findFirst({
    where: { token, active: true },
  });
  if (!feedToken) return new NextResponse("Unauthorized", { status: 401 });

  const commitments = await prisma.commitment.findMany({
    where: {
      userId: feedToken.userId,
      status: { in: ["pending", "overdue"] },
      dueDate: { not: null },
    },
    include: {
      thread: { select: { id: true, subject: true } },
      contact: { select: { name: true, email: true } },
    },
    orderBy: { dueDate: "asc" },
    take: 200,
  });

  const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
  const calendar = ical({
    name: "Emaily Commitments",
    method: ICalCalendarMethod.PUBLISH,
    prodId: { company: "Emaily", product: "Commitment Calendar" },
    timezone: "UTC",
  });

  for (const c of commitments) {
    const status = c.status === "overdue" ? ICalEventStatus.TENTATIVE : ICalEventStatus.CONFIRMED;
    const description = [
      c.description,
      c.sourceQuote ? `Quote: "${c.sourceQuote}"` : null,
      c.contact ? `Contact: ${c.contact.name || c.contact.email}` : null,
      c.thread ? `Thread: ${c.thread.subject}` : null,
      `${baseUrl}/thread/${c.threadId}`,
    ].filter(Boolean).join("\n\n");

    calendar.createEvent({
      id: c.id,
      summary: c.title,
      description,
      start: c.dueDate!,
      allDay: true,
      status,
      url: `${baseUrl}/thread/${c.threadId}`,
    });
  }

  return new NextResponse(calendar.toString(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": "attachment; filename=emaily-commitments.ics",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
```

**Step 5: Push schema + commit**

```bash
cd packages/database && DATABASE_URL="postgresql://emaily:emaily@localhost:5432/emaily" npx prisma db push
git add packages/database/prisma/schema.prisma apps/web/app/api/calendar/ apps/web/package.json
git commit -m "feat: add iCal calendar feed for commitment tracking"
```

---

### Task 6: MCP tools for commitments

**Files:**
- Create: `packages/mcp-server/src/tools/commitments.ts`
- Modify: `packages/mcp-server/src/tools/index.ts`

**Step 1: Create commitment MCP tools**

```typescript
// packages/mcp-server/src/tools/commitments.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { EmailyClient } from "../client.js";

export function registerCommitmentTools(server: McpServer, client: EmailyClient): void {
  server.tool(
    "list_commitments",
    "List tracked commitments (promises, requests, deadlines). Filter by status or type.",
    {
      status: z.enum(["pending", "fulfilled", "overdue", "dismissed", "snoozed"]).optional().describe("Filter by status"),
      type: z.enum(["outbound_promise", "inbound_promise", "open_request", "mentioned_date", "stale_thread"]).optional().describe("Filter by type"),
      limit: z.number().optional().describe("Max results (default 50)"),
    },
    async (params) => {
      const data = await client.get("/api/commitments", params);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "get_nudges",
    "Get upcoming, overdue, and stale commitments that need attention.",
    {},
    async () => {
      const data = await client.get("/api/commitments/nudges");
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );

  server.tool(
    "update_commitment",
    "Update a commitment's status (fulfill, dismiss, snooze).",
    {
      commitmentId: z.string().describe("Commitment ID"),
      status: z.enum(["fulfilled", "dismissed", "snoozed"]).describe("New status"),
      snoozeUntil: z.string().optional().describe("ISO date for snooze (required if status is snoozed)"),
    },
    async (params) => {
      const { commitmentId, ...body } = params;
      const data = await client.patch(`/api/commitments/${commitmentId}`, body);
      return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
    }
  );
}
```

**Step 2: Register in tool index**

Add to `packages/mcp-server/src/tools/index.ts`:
```typescript
import { registerCommitmentTools } from "./commitments.js";
// In registerAllTools():
registerCommitmentTools(server, client);
```

**Step 3: Commit**

```bash
git add packages/mcp-server/src/tools/commitments.ts packages/mcp-server/src/tools/index.ts
git commit -m "feat: add MCP tools for commitment tracking"
```

---

## Phase 2: Nudge Feed & Commitment UI

### Task 7: Nudge feed sidebar component

**Files:**
- Create: `apps/web/components/nudges/nudge-feed.tsx`
- Create: `apps/web/hooks/use-commitments.ts`

Build a sidebar component that fetches from `/api/commitments/nudges` and displays:
- Overdue items (red badge)
- Upcoming items (yellow badge)
- Stale items (gray)
- Each nudge: title, contact name, due date, link to thread, dismiss/snooze/done buttons
- Uses SWR for data fetching with 60s refresh interval

### Task 8: Commitment management page

**Files:**
- Create: `apps/web/app/(dashboard)/commitments/page.tsx`
- Modify: `apps/web/components/layout/sidebar.tsx` (add nav link)

Full page view of all commitments with:
- Tab filters: All | Pending | Overdue | Fulfilled | Dismissed
- Calendar feed subscription section (generate token, copy URL, show setup instructions)
- Bulk actions: dismiss, snooze
- Click to open source thread

### Task 9: Integrate nudge badge into inbox header

**Files:**
- Modify: `apps/web/components/layout/header.tsx` or equivalent

Add a nudge count badge next to notifications, linking to the nudge feed. Fetches `/api/commitments/nudges` and shows `totalNudges` count.

---

## Phase 3: Agent Playbooks

### Task 10: Extend Agent model with playbook fields

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/shared/src/types/index.ts`

Add to Agent model:
```prisma
  allowedTools      String[]  @default([]) @map("allowed_tools")
  triggerConditions  Json?     @map("trigger_conditions")
  escalationRules    Json?     @map("escalation_rules")
  approvalMode       String    @default("review") @map("approval_mode") // auto | review | suggest
  maxAutoConfidence  Float     @default(0.9) @map("max_auto_confidence")
```

Add corresponding TypeScript types and guards.

### Task 11: Agent playbook settings UI

**Files:**
- Modify: `apps/web/app/(dashboard)/settings/agents/page.tsx`

Extend the existing agent settings form with:
- Tool whitelist checkboxes (from `AGENT_TOOL_DEFINITIONS`)
- Approval mode select (auto/review/suggest)
- Max auto-confidence slider
- Trigger conditions builder (tag, trust level, mailbox selects)
- Escalation rules builder (condition → action pairs)

### Task 12: Apply playbook rules in agent loop

**Files:**
- Modify: `packages/ai-engine/src/pipeline/agent-loop.ts`

Before the agent loop runs:
- Filter available tools by agent's `allowedTools` whitelist
- Check trigger conditions to decide if this agent should process this thread
- After the loop produces a decision, apply escalation rules (override confidence thresholds, force human review for VIP senders, route to another agent)

---

## Phase 4: Action Queue & Approval Workflow

### Task 13: Add AgentAction model

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/shared/src/types/index.ts`

```prisma
model AgentAction {
  id          String   @id @default(cuid())
  agentId     String   @map("agent_id")
  threadId    String   @map("thread_id")
  type        String   // send_reply | apply_tag | assign | create_commitment | archive | escalate
  payload     Json     // action-specific data
  confidence  Float
  reasoning   String   @default("")
  status      String   @default("pending") // pending | approved | rejected | auto_approved | expired
  reviewedBy  String?  @map("reviewed_by")
  reviewedAt  DateTime? @map("reviewed_at")
  reviewNote  String?  @map("review_note")
  expiresAt   DateTime? @map("expires_at")
  createdAt   DateTime @default(now()) @map("created_at")

  agent       Agent    @relation(fields: [agentId], references: [id], onDelete: Cascade)
  thread      Thread   @relation(fields: [threadId], references: [id], onDelete: Cascade)
  reviewer    User?    @relation(fields: [reviewedBy], references: [id])

  @@index([status, createdAt])
  @@index([agentId, status])
  @@map("agent_actions")
}
```

### Task 14: Action queue API routes

**Files:**
- Create: `apps/web/app/api/agent-actions/route.ts` (GET list pending)
- Create: `apps/web/app/api/agent-actions/[id]/route.ts` (PATCH approve/reject)
- Create: `apps/web/app/api/agent-actions/batch/route.ts` (batch approve)

### Task 15: Action queue UI

**Files:**
- Create: `apps/web/app/(dashboard)/agent-actions/page.tsx`
- Create: `apps/web/components/agent-actions/action-review-card.tsx`

List of pending agent actions with:
- Agent name, action type, target thread, confidence score, reasoning
- Inline preview (draft content, tag name, assignee)
- One-click approve/reject/edit
- Batch approve for trusted agents
- Badge in header showing pending count

### Task 16: Wire agent loop to action queue

**Files:**
- Modify: `packages/ai-engine/src/pipeline/agent-loop.ts`
- Modify: AI processing API route (`apps/web/app/api/ai/process/route.ts`)

After agent loop produces a decision:
- Check agent's `approvalMode`
- If `review`: Create `AgentAction` records for each proposed action (tag, draft, assign)
- If `auto`: Check confidence against `maxAutoConfidence`. Above threshold → execute immediately. Below → queue for review.
- If `suggest`: Create `AgentAction` with status `pending`, never auto-execute

---

## Phase 5-10: Remaining Phases (Expand When Reached)

### Phase 5: Agent Collaboration (Tasks 17-18)
- Add `consultAgent` tool to `agent-tools.ts`
- Implement mini agent loop for consultation (single turn, read-only)
- Guard against circular calls, log consultations in AI activity
- Add collaboration history to thread context panel

### Phase 6: Learning from Corrections (Tasks 19-21)
- Activate `AiCorrection` capture on draft edits, tag overrides, assignment reassignments
- Build correction memory query: recent corrections per agent, filtered by sender/tag/topic
- Inject correction examples into agent system prompt context
- Dashboard showing agent accuracy trends over time

### Phase 7: Thread Context Panel (Tasks 22-23)
- New sidebar component showing: AI summary, related threads, contact card, internal timeline, active commitments
- API route: `/api/threads/[id]/context` aggregating all context data
- Lazy-load related threads via search

### Phase 8: AI Auto-Assignment (Tasks 24-26)
- Add `expertiseTags` field to User model
- Build assignment scoring function (past interactions, expertise match, workload balance)
- Create auto-assignment config per mailbox
- Learn from manual reassignments

### Phase 9: Handoff Protocol (Tasks 27-28)
- Extend Assignment model with `handoffSummary` and `handoffNote`
- Auto-generate handoff summary via AI on reassignment
- Notification with full context package to new assignee

### Phase 10: SLA Monitoring (Tasks 29-31)
- Add `SlaRule` and `ThreadSlaStatus` models
- SLA evaluation cron/check on thread updates
- Breach escalation logic (notify, reassign, trigger agent)
- SLA health dashboard

---

## Testing Strategy

Each phase includes tests:
- **Unit tests**: Prompt builders, parsers, validators (Vitest in ai-engine/shared)
- **API tests**: Route handlers with mocked Prisma (Vitest in apps/web)
- **Integration**: MCP tools calling API routes
- **Pattern**: TDD — write failing test, implement, verify pass, commit

## Verification

After each phase:
1. `pnpm test` — all tests pass
2. `pnpm build` — clean build
3. `pnpm lint` — no warnings
4. Manual verification of new UI components
