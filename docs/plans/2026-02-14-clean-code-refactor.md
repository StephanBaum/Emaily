# Clean Code Refactoring Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Comprehensive refactor of the web app to comply with Clean Code principles (DRY, KISS, SRP, meaningful names, small functions <20 lines).

**Architecture:**
- Phase A: Extract constants and create reusable utilities
- Phase B: Refactor nudges API into service layer
- Phase C: Break down massive `processThreadWithAI()` function
- Phase D: Fix duplicate patterns and improve naming

**Tech Stack:** TypeScript, Next.js API routes, React hooks, Prisma

---

# Phase A: Constants & Utilities

## Task 1: Create Constants File

**Files:**
- Create: `apps/web/lib/constants.ts`

**Step 1: Create the constants file**

```typescript
// apps/web/lib/constants.ts

// Time constants
export const MS_PER_SECOND = 1000;
export const MS_PER_MINUTE = MS_PER_SECOND * 60;
export const MS_PER_HOUR = MS_PER_MINUTE * 60;
export const MS_PER_DAY = MS_PER_HOUR * 24;

export const STALE_THREAD_DAYS = 3;
export const STALE_THREAD_MS = STALE_THREAD_DAYS * MS_PER_DAY;

// UI timing
export const REVALIDATION_DELAY_MS = 500;

// API limits
export const NUDGE_LIMIT = 10;
export const DEFAULT_THREAD_LIMIT = 50;
export const MAX_THREAD_LIMIT = 100;
export const EMAIL_PREVIEW_LENGTH = 150;
export const SKELETON_THREAD_COUNT = 6;

// AI processing limits
export const AI_QA_PAIRS_LIMIT = 20;
export const AI_ACTIVITY_LOG_LIMIT = 20;
export const AI_COMMENTS_LIMIT = 10;
export const AI_BATCH_SIZE = 5;

// Redis retry config
export const REDIS_MAX_RETRIES = 3;
export const REDIS_MAX_BACKOFF_MS = 2000;
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/lib/constants.ts
git commit -m "refactor: extract magic numbers to constants file"
```

---

## Task 2: Create Format Utilities

**Files:**
- Create: `apps/web/lib/format.ts`

**Step 1: Create formatting utilities**

```typescript
// apps/web/lib/format.ts

/**
 * Format a count with singular/plural form.
 * @example formatPlural(1, "message", "messages") => "1 message"
 * @example formatPlural(5, "message", "messages") => "5 messages"
 */
export function formatPlural(
  count: number,
  singular: string,
  plural: string
): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Format relative time in human-readable form.
 * @example formatRelativeTime(2, "day") => "2 days ago"
 */
export function formatRelativeTime(value: number, unit: string): string {
  const unitStr = value === 1 ? unit : `${unit}s`;
  return `${value} ${unitStr} ago`;
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/lib/format.ts
git commit -m "refactor: add formatting utilities"
```

---

## Task 3: Create Thread Cache Invalidation Utility

**Files:**
- Create: `apps/web/lib/cache-utils.ts`

**Step 1: Create cache invalidation helper**

```typescript
// apps/web/lib/cache-utils.ts
import { mutate } from "swr";

/**
 * Invalidate all thread-related SWR caches.
 * Call after any thread mutation (status, delete, tag changes).
 */
export function invalidateThreadCaches(): void {
  mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
  mutate("/api/mailboxes");
  mutate("/api/nudges");
  mutate("/api/ai/summary");
}

/**
 * Invalidate thread caches after a delay (for optimistic updates).
 */
export function invalidateThreadCachesDelayed(delayMs: number): void {
  setTimeout(() => invalidateThreadCaches(), delayMs);
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/lib/cache-utils.ts
git commit -m "refactor: add thread cache invalidation utility"
```

---

# Phase B: Nudges API Refactor

## Task 4: Create Nudges Service - Helper Functions

**Files:**
- Create: `apps/web/lib/services/nudges-service.ts`

**Step 1: Create the nudges service with type definitions and helpers**

```typescript
// apps/web/lib/services/nudges-service.ts
import { prisma } from "@/lib/prisma";
import { STALE_THREAD_MS, MS_PER_DAY, NUDGE_LIMIT } from "@/lib/constants";

export interface NudgeThread {
  id: string;
  subject: string;
  senderName: string | null;
  senderEmail: string;
  senderTrustLevel: string | null;
  lastActivityAt: Date;
  daysSince: number;
  nudgeType: "needs_reply" | "awaiting_response";
}

export interface NudgesResponse {
  needsReply: NudgeThread[];
  awaitingResponse: NudgeThread[];
  totalNudges: number;
}

export function getStaleThreshold(): Date {
  return new Date(Date.now() - STALE_THREAD_MS);
}

export function calculateDaysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / MS_PER_DAY);
}

export function isFromMailbox(email: string, mailboxEmails: string[]): boolean {
  return mailboxEmails.includes(email.toLowerCase());
}

export async function getUserMailboxIds(userId: string): Promise<string[]> {
  const access = await prisma.mailboxAccess.findMany({
    where: { userId },
    select: { mailboxId: true },
  });
  return access.map((a) => a.mailboxId);
}

export async function getMailboxEmails(mailboxIds: string[]): Promise<string[]> {
  const mailboxes = await prisma.mailbox.findMany({
    where: { id: { in: mailboxIds } },
    select: { emailAddress: true },
  });
  return mailboxes.map((m) => m.emailAddress.toLowerCase());
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/lib/services/nudges-service.ts
git commit -m "refactor: create nudges service with helper functions"
```

---

## Task 5: Create Nudges Service - Query Functions

**Files:**
- Modify: `apps/web/lib/services/nudges-service.ts`

**Step 1: Add the thread query functions**

Add after the existing helper functions:

```typescript
interface ThreadWithEmails {
  id: string;
  subject: string;
  senderTrustLevel: string | null;
  lastActivityAt: Date;
  emails: {
    fromAddress: string;
    fromName: string | null;
    isSent: boolean;
    toAddresses: string[];
  }[];
}

async function queryNeedsReplyThreads(
  mailboxIds: string[],
  staleThreshold: Date
): Promise<ThreadWithEmails[]> {
  return prisma.thread.findMany({
    where: {
      mailboxId: { in: mailboxIds },
      status: "open",
      hasSentReply: false,
      lastActivityAt: { lt: staleThreshold },
      OR: [{ aiNeedsReply: true }, { aiNeedsReply: null }],
    },
    include: {
      emails: {
        orderBy: { date: "desc" },
        take: 1,
        select: {
          fromAddress: true,
          fromName: true,
          isSent: true,
          toAddresses: true,
        },
      },
    },
    orderBy: [{ senderTrustLevel: "asc" }, { lastActivityAt: "asc" }],
    take: NUDGE_LIMIT,
  });
}

async function queryAwaitingResponseThreads(
  mailboxIds: string[],
  staleThreshold: Date
): Promise<ThreadWithEmails[]> {
  return prisma.thread.findMany({
    where: {
      mailboxId: { in: mailboxIds },
      status: "open",
      lastActivityAt: { lt: staleThreshold },
    },
    include: {
      emails: {
        orderBy: { date: "desc" },
        take: 2,
        select: {
          fromAddress: true,
          fromName: true,
          isSent: true,
          toAddresses: true,
        },
      },
    },
    orderBy: [{ senderTrustLevel: "asc" }, { lastActivityAt: "asc" }],
    take: NUDGE_LIMIT,
  });
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/lib/services/nudges-service.ts
git commit -m "refactor: add thread query functions to nudges service"
```

---

## Task 6: Create Nudges Service - Mapping & Main Functions

**Files:**
- Modify: `apps/web/lib/services/nudges-service.ts`

**Step 1: Add the mapping functions and main orchestration**

Add after the query functions:

```typescript
function mapToNeedsReplyNudge(
  thread: ThreadWithEmails,
  mailboxEmails: string[]
): NudgeThread | null {
  const lastEmail = thread.emails[0];
  if (!lastEmail) return null;

  const isInbound = !isFromMailbox(lastEmail.fromAddress, mailboxEmails);
  if (!isInbound) return null;

  return {
    id: thread.id,
    subject: thread.subject,
    senderName: lastEmail.fromName,
    senderEmail: lastEmail.fromAddress,
    senderTrustLevel: thread.senderTrustLevel,
    lastActivityAt: thread.lastActivityAt,
    daysSince: calculateDaysSince(thread.lastActivityAt),
    nudgeType: "needs_reply",
  };
}

function mapToAwaitingResponseNudge(
  thread: ThreadWithEmails,
  mailboxEmails: string[]
): NudgeThread | null {
  const lastEmail = thread.emails[0];
  if (!lastEmail) return null;

  const isOutbound =
    isFromMailbox(lastEmail.fromAddress, mailboxEmails) || lastEmail.isSent;
  if (!isOutbound) return null;

  const recipient = lastEmail.toAddresses?.[0] || "";
  const recipientName =
    thread.emails[1]?.fromName || recipient.split("@")[0] || "Unknown";

  return {
    id: thread.id,
    subject: thread.subject,
    senderName: recipientName,
    senderEmail: recipient,
    senderTrustLevel: thread.senderTrustLevel,
    lastActivityAt: thread.lastActivityAt,
    daysSince: calculateDaysSince(thread.lastActivityAt),
    nudgeType: "awaiting_response",
  };
}

export async function getNudgesForUser(userId: string): Promise<NudgesResponse> {
  const mailboxIds = await getUserMailboxIds(userId);
  if (mailboxIds.length === 0) {
    return { needsReply: [], awaitingResponse: [], totalNudges: 0 };
  }

  const mailboxEmails = await getMailboxEmails(mailboxIds);
  const staleThreshold = getStaleThreshold();

  const [needsReplyThreads, awaitingResponseThreads] = await Promise.all([
    queryNeedsReplyThreads(mailboxIds, staleThreshold),
    queryAwaitingResponseThreads(mailboxIds, staleThreshold),
  ]);

  const needsReply = needsReplyThreads
    .map((thread) => mapToNeedsReplyNudge(thread, mailboxEmails))
    .filter((nudge): nudge is NudgeThread => nudge !== null);

  const awaitingResponse = awaitingResponseThreads
    .map((thread) => mapToAwaitingResponseNudge(thread, mailboxEmails))
    .filter((nudge): nudge is NudgeThread => nudge !== null);

  return {
    needsReply,
    awaitingResponse,
    totalNudges: needsReply.length + awaitingResponse.length,
  };
}
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/lib/services/nudges-service.ts
git commit -m "refactor: add mapping and main functions to nudges service"
```

---

## Task 7: Refactor Nudges API Route

**Files:**
- Modify: `apps/web/app/api/nudges/route.ts`

**Step 1: Replace the entire file with the slim version**

```typescript
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
```

**Step 2: Verify build passes**

Run: `cd apps/web && pnpm build`
Expected: Build succeeds

**Step 3: Commit**

```bash
git add apps/web/app/api/nudges/route.ts
git commit -m "refactor: simplify nudges API route using service layer"
```

---

# Phase C: Update Existing Code to Use Constants

## Task 8: Update Thread Updates Context

**Files:**
- Modify: `apps/web/contexts/thread-updates-context.tsx`

**Step 1: Import and use constants and cache utility**

At the top, add:
```typescript
import { REVALIDATION_DELAY_MS } from "@/lib/constants";
import { invalidateThreadCaches } from "@/lib/cache-utils";
```

In `updateStatus` function (around line 162-170), replace:
```typescript
// Before:
mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
mutate("/api/mailboxes");
mutate("/api/nudges");
mutate("/api/ai/summary");
setTimeout(() => clearUpdate(threadId), 500);

// After:
invalidateThreadCaches();
setTimeout(() => clearUpdate(threadId), REVALIDATION_DELAY_MS);
```

In `deleteThread` function (around line 190-200), replace:
```typescript
// Before:
mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
setTimeout(() => clearUpdate(threadId), 500);

// After:
invalidateThreadCaches();
setTimeout(() => clearUpdate(threadId), REVALIDATION_DELAY_MS);
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/contexts/thread-updates-context.tsx
git commit -m "refactor: use constants and cache utility in thread updates context"
```

---

## Task 9: Update Batch Selection Hook

**Files:**
- Modify: `apps/web/hooks/use-batch-selection.ts`

**Step 1: Import and use constants and cache utility**

At the top, add:
```typescript
import { REVALIDATION_DELAY_MS } from "@/lib/constants";
import { invalidateThreadCaches } from "@/lib/cache-utils";
```

In `batchUpdateStatus` function (around line 70-80), replace:
```typescript
// Before:
mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
mutate("/api/mailboxes");
mutate("/api/nudges");
setTimeout(() => ids.forEach((id) => clearUpdate(id)), 500);

// After:
invalidateThreadCaches();
setTimeout(() => ids.forEach((id) => clearUpdate(id)), REVALIDATION_DELAY_MS);
```

In `batchDelete` function (around line 105-115), replace:
```typescript
// Before:
mutate((key) => typeof key === "string" && key.startsWith("/api/threads"));
setTimeout(() => ids.forEach((id) => clearUpdate(id)), 500);

// After:
invalidateThreadCaches();
setTimeout(() => ids.forEach((id) => clearUpdate(id)), REVALIDATION_DELAY_MS);
```

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/hooks/use-batch-selection.ts
git commit -m "refactor: use constants and cache utility in batch selection hook"
```

---

## Task 10: Update Threads API Route to Use Constants

**Files:**
- Modify: `apps/web/app/api/threads/route.ts`

**Step 1: Import constants**

At the top, add:
```typescript
import { DEFAULT_THREAD_LIMIT, MAX_THREAD_LIMIT, EMAIL_PREVIEW_LENGTH } from "@/lib/constants";
```

**Step 2: Replace magic numbers**

Find and replace:
- `50` (default limit) → `DEFAULT_THREAD_LIMIT`
- `100` (max limit) → `MAX_THREAD_LIMIT`
- `150` (preview length) → `EMAIL_PREVIEW_LENGTH`

**Step 3: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add apps/web/app/api/threads/route.ts
git commit -m "refactor: use constants in threads API route"
```

---

## Task 11: Update Cache.ts to Use Constants

**Files:**
- Modify: `apps/web/lib/cache.ts`

**Step 1: Import constants**

At the top, add:
```typescript
import { REDIS_MAX_RETRIES, REDIS_MAX_BACKOFF_MS } from "@/lib/constants";
```

**Step 2: Replace magic numbers**

Find and replace:
- `3` (max retries) → `REDIS_MAX_RETRIES`
- `2000` (max backoff) → `REDIS_MAX_BACKOFF_MS`

**Step 3: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add apps/web/lib/cache.ts
git commit -m "refactor: use constants in cache utility"
```

---

## Task 12: Update Thread List to Use Constants

**Files:**
- Modify: `apps/web/components/inbox/thread-list.tsx`

**Step 1: Import constants**

At the top, add:
```typescript
import { SKELETON_THREAD_COUNT } from "@/lib/constants";
```

**Step 2: Replace magic number**

Find and replace:
- `6` (skeleton count) → `SKELETON_THREAD_COUNT`

**Step 3: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add apps/web/components/inbox/thread-list.tsx
git commit -m "refactor: use constant for skeleton thread count"
```

---

# Phase D: Improve Variable Naming

## Task 13: Fix Single-Letter Variables in AI.ts

**Files:**
- Modify: `apps/web/lib/ai.ts`

**Step 1: Find and replace single-letter callbacks**

Search and replace (in callback functions only):
- `.map((t) =>` → `.map((tag) =>`  (for tag arrays)
- `.map((a) =>` → `.map((attachment) =>`  (for attachment arrays)
- `.map((c) =>` → `.map((comment) =>`  (for comment arrays)
- `.filter((t) =>` → `.filter((tag) =>`  (for tag arrays)

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/lib/ai.ts
git commit -m "refactor: improve variable naming in AI service"
```

---

## Task 14: Fix Single-Letter Variables in Dashboard

**Files:**
- Modify: `apps/web/components/dashboard/inbox-dashboard.tsx`

**Step 1: Find and replace single-letter callbacks**

Search and replace:
- `.map(t =>` → `.map(thread =>`
- `.map(i =>` → `.map(item =>`
- `.flatMap(i =>` → `.flatMap(item =>`

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/components/dashboard/inbox-dashboard.tsx
git commit -m "refactor: improve variable naming in inbox dashboard"
```

---

## Task 15: Fix Single-Letter Variables in Filter Toolbar

**Files:**
- Modify: `apps/web/components/inbox/filter-toolbar.tsx`

**Step 1: Find and replace single-letter callbacks**

Search and replace:
- `.map((t) =>` → `.map((tag) =>`  (for tag arrays)

**Step 2: Verify TypeScript compiles**

Run: `cd apps/web && pnpm exec tsc --noEmit`
Expected: No type errors

**Step 3: Commit**

```bash
git add apps/web/components/inbox/filter-toolbar.tsx
git commit -m "refactor: improve variable naming in filter toolbar"
```

---

## Task 16: Final Verification

**Step 1: Run full build**

Run: `pnpm build`
Expected: All packages build successfully

**Step 2: Run tests**

Run: `pnpm test`
Expected: All tests pass

**Step 3: Final commit (if any unstaged changes)**

```bash
git status
# If clean, no action needed
```

---

# Verification Checklist

After completing all tasks:
- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] No TypeScript errors
- [ ] Nudges API route is <20 lines
- [ ] All nudges service functions are <20 lines each
- [ ] No magic numbers remain in modified files
- [ ] Constants are imported from `@/lib/constants`
- [ ] Thread cache invalidation uses `invalidateThreadCaches()`
- [ ] No single-letter variables in callbacks (t, i, a, c, m, etc.)

---

# Summary

| Phase | Task | Description | Files Changed |
|-------|------|-------------|---------------|
| A | 1 | Create constants file | 1 new |
| A | 2 | Create format utilities | 1 new |
| A | 3 | Create cache invalidation utility | 1 new |
| B | 4 | Create nudges service helpers | 1 new |
| B | 5 | Add query functions | 1 modified |
| B | 6 | Add mapping/main functions | 1 modified |
| B | 7 | Refactor API route | 1 modified |
| C | 8 | Update thread updates context | 1 modified |
| C | 9 | Update batch selection hook | 1 modified |
| C | 10 | Update threads API route | 1 modified |
| C | 11 | Update cache.ts | 1 modified |
| C | 12 | Update thread list | 1 modified |
| D | 13 | Fix naming in ai.ts | 1 modified |
| D | 14 | Fix naming in dashboard | 1 modified |
| D | 15 | Fix naming in filter toolbar | 1 modified |
| D | 16 | Final verification | 0 |

**Total:** 4 new files, 11 modified files

---

# Future Work (Not in this plan)

These items were identified but are larger refactors for a separate plan:

1. **Break down `processThreadWithAI()`** - 659 lines, needs to be split into 10+ smaller functions
2. **Split `CommentSection` component** - Create separate `CompactCommentSection` and `FullCommentSection`
3. **Refactor `GET /api/threads`** - 189 lines, extract filters/sorting/pagination into helpers
4. **Add comprehensive error handling** - Several fire-and-forget catches that swallow errors
