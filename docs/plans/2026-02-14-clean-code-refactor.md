# Clean Code Refactoring Plan

**Date:** 2026-02-14
**Branch:** `v2` (or create `refactor/clean-code`)

## Overview

Refactor recent code to comply with Clean Code principles from `docs/Principles/code.md`.

---

## Phase 1: Extract Constants (Quick Win)

### Files to modify:
- `apps/web/app/api/nudges/route.ts`
- `apps/web/contexts/thread-updates-context.tsx`
- `apps/web/hooks/use-batch-selection.ts`

### Changes:
```typescript
// Create: apps/web/lib/constants.ts
export const STALE_THREAD_DAYS = 3;
export const STALE_THREAD_MS = STALE_THREAD_DAYS * 24 * 60 * 60 * 1000;
export const REVALIDATION_DELAY_MS = 500;
export const NUDGE_LIMIT = 10;
```

---

## Phase 2: Refactor Nudges API (DRY)

### Current issues:
- GET function is ~150 lines (should be <20)
- Duplicate Prisma query logic
- Duplicate mapping logic
- Inline calculations

### Target structure:
```typescript
// apps/web/app/api/nudges/route.ts

// Extract to: apps/web/lib/services/nudges-service.ts
export async function getNudgesForUser(userId: string): Promise<NudgesResponse> {
  const mailboxIds = await getUserMailboxIds(userId);
  const mailboxEmails = await getMailboxEmails(mailboxIds);
  const staleThreshold = getStaleThreshold();

  const [needsReply, awaitingResponse] = await Promise.all([
    findNeedsReplyThreads(mailboxIds, mailboxEmails, staleThreshold),
    findAwaitingResponseThreads(mailboxIds, mailboxEmails, staleThreshold),
  ]);

  return { needsReply, awaitingResponse, totalNudges: needsReply.length + awaitingResponse.length };
}

// Helper functions (each <20 lines):
function getUserMailboxIds(userId: string): Promise<string[]>
function getMailboxEmails(mailboxIds: string[]): Promise<string[]>
function getStaleThreshold(): Date
function findNeedsReplyThreads(...): Promise<NudgeThread[]>
function findAwaitingResponseThreads(...): Promise<NudgeThread[]>
function mapThreadToNudge(thread, type, now): NudgeThread
function isInboundEmail(email, mailboxEmails): boolean
function isOutboundEmail(email, mailboxEmails): boolean
function calculateDaysSince(date: Date, now: Date): number
```

### API route becomes:
```typescript
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

---

## Phase 3: Refactor Thread Actions (DRY)

### Current issues:
- `updateStatus` and `deleteThread` have duplicate patterns
- `batchUpdateStatus` and `batchDelete` have duplicate patterns

### Target structure:
```typescript
// apps/web/lib/optimistic-actions.ts

interface OptimisticActionOptions {
  onOptimisticUpdate: () => void;
  apiCall: () => Promise<Response>;
  onSuccess: () => void;
  onError: () => void;
  revalidateKeys: string[];
}

export async function executeOptimisticAction(options: OptimisticActionOptions): Promise<void> {
  options.onOptimisticUpdate();

  try {
    const res = await options.apiCall();
    if (!res.ok) throw new Error("Request failed");

    options.revalidateKeys.forEach(key => mutate(key));
    setTimeout(options.onSuccess, REVALIDATION_DELAY_MS);
  } catch (error) {
    options.onError();
    throw error;
  }
}
```

### Usage in context:
```typescript
const updateStatus = useCallback(async (newStatus: string) => {
  await executeOptimisticAction({
    onOptimisticUpdate: () => markStatusChange(threadId, newStatus),
    apiCall: () => fetch(`/api/threads/${threadId}/status`, { method: "PATCH", ... }),
    onSuccess: () => clearUpdate(threadId),
    onError: () => clearUpdate(threadId),
    revalidateKeys: ["/api/threads", "/api/mailboxes", "/api/nudges"],
  });
}, [threadId, markStatusChange, clearUpdate]);
```

---

## Phase 4: Improve Naming

### Files to update:
- All files using single-letter variables in callbacks

### Changes:
| Before | After |
|--------|-------|
| `t` | `thread` |
| `i` | `item` |
| `s` | `status` |
| `a` | `access` |
| `m` | `mailbox` |
| `g` | `group` |

---

## Phase 5: Add Error Handling

### Nudges API:
```typescript
try {
  const nudges = await getNudgesForUser(session.user.id);
  return NextResponse.json(nudges);
} catch (error) {
  console.error("Nudges fetch failed:", error);
  return NextResponse.json({ error: "Failed to fetch nudges" }, { status: 500 });
}
```

### IMAP Worker:
```typescript
// Differentiate error types
catch (error) {
  if (error instanceof AuthenticationError) {
    // Don't retry auth errors
    await updateOperationStatus(id, "failed", "Authentication failed");
    return;
  }
  if (error instanceof ConnectionError) {
    // Retry connection errors
    throw error;
  }
  // Log unknown errors
  console.error("Unknown IMAP error:", error);
  throw error;
}
```

---

## Verification Checklist

After each phase:
- [ ] `pnpm build` passes
- [ ] No new TypeScript errors
- [ ] Functions are <20 lines
- [ ] No magic numbers
- [ ] No duplicate code blocks
- [ ] Meaningful variable names

---

## Estimated Scope

| Phase | Files Changed | Complexity |
|-------|---------------|------------|
| 1. Constants | 4 | Low |
| 2. Nudges API | 2 (new service) | Medium |
| 3. Thread Actions | 3 | Medium |
| 4. Naming | 5-10 | Low |
| 5. Error Handling | 3 | Low |

**Total:** ~15 files, can be done incrementally with commits per phase.
