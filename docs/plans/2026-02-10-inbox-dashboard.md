# Clean Inbox Dashboard Redesign

## Context

The current inbox shows all open threads in a flat list. When AI processes mail (auto-archiving newsletters, tagging notifications, quarantining spam), threads disappear from the inbox with no visibility into what happened. Users see "AI processed 9 mails" but nothing appears because everything got archived. This redesign separates AI-processed mail from unprocessed mail and adds an activity summary so users always know what the AI did.

## Branch

Create `feature/inbox-dashboard` from `feature/ai-integration`.

## Phase 1: API — AI Activity Summary Endpoint

**New: `apps/web/app/api/ai/summary/route.ts`**
- `GET /api/ai/summary` — AI activity grouped by action type
- Query `ActivityLog` for recent AI actions (last 24h default, `?hours=` param)
- Group by action: `ai_archived`, `ai_tagged`, `ai_draft_generated`, `ai_auto_replied`, `ai_quarantined`
- Each group includes: action label, count, affected threads with subject + sender info
- Join `Thread` → latest inbound `Email` for sender name/email
- Join `ThreadTag` for applied tag names/colors
- Auth-gated to user's accessible mailboxes

**Modify: `packages/shared/src/types/index.ts`**
- Add `AISummaryGroup` and `AISummaryItem` types:

```typescript
export interface AISummaryItem {
  threadId: string;
  subject: string;
  senderName: string | null;
  senderEmail: string;
  tags: { name: string; color: string }[];
}

export interface AISummaryGroup {
  action: ActivityAction;
  label: string;
  count: number;
  items: AISummaryItem[];
}
```

## Phase 2: Threads API — Unprocessed Filter

**Modify: `apps/web/app/api/threads/route.ts`**
- Add `?filter=unprocessed` parameter
- Filters to threads with NO AI-applied tags (`ThreadTag` where `appliedBy = 'ai'`) AND `status = 'open'`
- These are the "real inbox" — threads AI hasn't touched yet
- Existing filters (mailbox, status, tag, search) continue working alongside

## Phase 3: Dashboard Components

**New: `apps/web/components/dashboard/ai-summary-panel.tsx`**
- Collapsible panel at top of inbox
- Shows AI activity grouped by action type ("Archived 3", "Tagged 5", "Drafted 2")
- Each group expandable to show thread pills
- Collapse state in localStorage
- "Dismiss" hides panel until new activity

**New: `apps/web/components/dashboard/ai-summary-group.tsx`**
- Single action group with count badge
- Expandable list of ThreadPill components
- Icon + color per action type (archive=folder, tag=tag, draft=pencil, quarantine=shield)

**New: `apps/web/components/dashboard/thread-pill.tsx`**
- Compact clickable pill: sender avatar (initials), truncated subject, tag badges
- Click navigates to thread
- Hover shows full subject + sender

**New: `apps/web/hooks/use-ai-summary.ts`**
- SWR hook for `/api/ai/summary`
- 30s polling
- Returns grouped data + loading/error states

## Phase 4: Inbox Page Integration

**Modify: `apps/web/app/(dashboard)/inbox/page.tsx`**
- Add `AISummaryPanel` above thread list
- Default inbox view passes `filter=unprocessed` to thread list
- Sidebar tag/status navigation still works as before

**Modify: `apps/web/components/thread/thread-list.tsx`**
- Support `unprocessed` filter param
- Show priority indicator for VIP/trusted senders
- "All caught up" empty state when no unprocessed threads

**Modify: `apps/web/hooks/use-threads.ts`**
- Pass `filter=unprocessed` query param when applicable

## Phase 5: Priority Sorting + Trust Integration

**Modify: `apps/web/app/api/threads/route.ts`**
- When `filter=unprocessed`, secondary sort by sender trust level
- VIP > trusted > known > stranger
- Join through latest inbound email → Contact → trustLevel

## Phase 6: AI Corrections / Learning

**New: `apps/web/app/api/ai/corrections/route.ts`**
- `POST /api/ai/corrections` — log user undoing AI actions
- Records: threadId, originalAction, correctedAction, userId
- Updates contact trust based on corrections (un-archive stranger → bump to known)
- Future: feed corrections into AI prompt context

## Files Summary

**New (6):**
1. `apps/web/app/api/ai/summary/route.ts`
2. `apps/web/app/api/ai/corrections/route.ts`
3. `apps/web/components/dashboard/ai-summary-panel.tsx`
4. `apps/web/components/dashboard/ai-summary-group.tsx`
5. `apps/web/components/dashboard/thread-pill.tsx`
6. `apps/web/hooks/use-ai-summary.ts`

**Modified (6):**
1. `packages/shared/src/types/index.ts` — summary types
2. `apps/web/app/api/threads/route.ts` — unprocessed filter + trust sort
3. `apps/web/app/(dashboard)/inbox/page.tsx` — dashboard layout
4. `apps/web/components/thread/thread-list.tsx` — filter + priority
5. `apps/web/hooks/use-threads.ts` — filter param
6. `apps/web/components/sidebar/sidebar.tsx` — unread = unprocessed count (if applicable)

## Verification

1. `pnpm build` — compiles without errors
2. `pnpm lint` — no lint violations
3. Start dev server, open inbox — see AI summary panel at top, unprocessed threads below
4. Trigger AI processing (`POST /api/process-all`) — summary panel updates with action groups
5. Click thread pill — navigates to correct thread
6. Collapse/expand summary panel — state persists on reload
7. VIP/trusted sender threads appear above stranger threads
