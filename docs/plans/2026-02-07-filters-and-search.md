# Filter System & Search Implementation Plan

## Overview

Two features to improve thread discovery and organization:

1. **Filter toolbar** in the inbox header replacing hard-coded sidebar navigation with composable filters (status, tags, mailbox)
2. **Full-text search** starting with PostgreSQL `tsvector` keyword search, designed so pgvector semantic search can layer on top later

---

## Part 1: Filter Toolbar

### Problem

- Clicking a tag in the sidebar only shows `status=open` threads. Archived/snoozed threads with that tag are invisible.
- The archive view has no structure -- it's a flat chronological list with no way to narrow by tag or mailbox.
- Filters are currently mutually exclusive via sidebar links (you pick status OR tag, not both).

### Design

A **filter toolbar** sits in the inbox header. It has two modes:

**Full mode** (Archive, Inbox, Snoozed views):
```
[ Status: Open/Archived/Snoozed/All ] [ Tags: ... ] [ Mailbox: ... ] [ Search... ]
```

**Simplified mode** (Tag view -- when entering via sidebar tag click):
```
[ Status: Open/Archived/Snoozed/All ]
```
Tag is already determined by the sidebar selection, so only status tabs are shown.

The active filters are reflected in URL search params so views are shareable/bookmarkable.

### Steps

#### Step 1: Create `<FilterToolbar>` component

**File:** `apps/web/components/inbox/filter-toolbar.tsx`

A client component that reads and writes URL search params.

Props/behavior:
- Reads current `searchParams` (status, tag, tags, mailbox, group)
- Determines mode: if `tag` or `tags` param exists -> simplified mode (status tabs only)
- Renders filter controls:
  - **Status tabs**: pill/toggle buttons for `All | Open | Archived | Snoozed`. "All" sends no status param to the API.
  - **Tag multi-select** (full mode only): popover with checkboxes, shows selected tags as badges. Uses existing tag data from `useTags()` hook.
  - **Mailbox select** (full mode only): dropdown of user's mailboxes from `useMailboxes()`.
- Uses `router.push()` to update URL params on filter change (keeps it bookmarkable).
- Displays active filter count badge when filters are applied.
- "Clear filters" button when any non-default filter is active.

UI components to use: `Button` (toggle variants), `Popover` + `Badge` (tag picker), `DropdownMenu` (mailbox), existing shadcn primitives.

#### Step 2: Update threads API to support `status=all`

**File:** `apps/web/app/api/threads/route.ts`

Current code:
```typescript
const status = searchParams.get("status") || "open";
const where = { status, ... };
```

Change to:
```typescript
const status = searchParams.get("status");
const where: Record<string, unknown> = {
  mailboxId: ...,
};
if (status && status !== "all") {
  where.status = status;
}
// If no status param and no tag filter, default to "open" (inbox behavior)
// If tag filter is active and no explicit status, show all statuses
if (!status && !tagId && !tagIds) {
  where.status = "open";
}
```

This means:
- `/api/threads` (no params) -> defaults to open (inbox)
- `/api/threads?tag=X` (tag, no status) -> all statuses for that tag
- `/api/threads?tag=X&status=archived` -> only archived with that tag
- `/api/threads?status=all` -> explicitly all statuses

#### Step 3: Update `useThreads` hook

**File:** `apps/web/hooks/use-threads.ts`

Add support for passing `status=all`:
```typescript
if (params?.status && params.status !== "open") {
  searchParams.set("status", params.status);
}
```
Currently it always sets status. Change so `"all"` is passed through.

#### Step 4: Integrate toolbar into inbox page

**File:** `apps/web/app/(dashboard)/inbox/page.tsx`

Replace the simple header with:
```tsx
<header className="flex h-14 items-center border-b px-6 gap-4">
  <h1 className="text-lg font-semibold shrink-0">{title}</h1>
  <FilterToolbar
    status={params.status}
    tagId={params.tag}
    tagIds={params.tags}
    mailboxId={params.mailbox}
    group={params.group}
  />
</header>
```

Pass current params to toolbar. The toolbar reads them as defaults and updates URL on change.

#### Step 5: Update ThreadList to pass status through

**File:** `apps/web/components/inbox/thread-list.tsx`

Ensure it passes the status prop correctly to `useThreads`, including `"all"`.

#### Step 6: Visual status indicators on thread items

**File:** `apps/web/components/inbox/thread-item.tsx`

When viewing mixed statuses (status=all or tag view), show a subtle status badge on each thread:
- Archived: muted badge or icon
- Snoozed: clock icon with snooze indicator
- Open: no badge (default)

This prevents confusion when archived/snoozed threads appear alongside open ones.

---

## Part 2: Full-Text Search

### Design

#### Phase A: PostgreSQL tsvector keyword search

Use Postgres native full-text search. It handles stemming, ranking, and is fast with GIN indexes. No external dependencies.

Searchable fields: `email.subject`, `email.bodyText`, `email.fromName`, `email.fromAddress`.

#### Phase B (future): pgvector semantic search

Layer semantic search on top using the existing `embedding` column on the Email model. Requires Ollama embedding model. Falls back to keyword search if AI service is unavailable.

### Steps (Phase A only)

#### Step 1: Add tsvector column and GIN index via migration

**File:** New Prisma migration (raw SQL since Prisma doesn't support tsvector natively)

```sql
-- Add tsvector column to emails
ALTER TABLE emails ADD COLUMN search_vector tsvector;

-- Populate for existing emails
UPDATE emails SET search_vector =
  setweight(to_tsvector('english', coalesce(subject, '')), 'A') ||
  setweight(to_tsvector('english', coalesce(from_name, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(from_address, '')), 'B') ||
  setweight(to_tsvector('english', coalesce(body_text, '')), 'C');

-- GIN index for fast search
CREATE INDEX idx_emails_search_vector ON emails USING GIN(search_vector);

-- Auto-update trigger on insert/update
CREATE OR REPLACE FUNCTION emails_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.subject, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.from_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.from_address, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.body_text, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER emails_search_vector_trigger
  BEFORE INSERT OR UPDATE OF subject, body_text, from_name, from_address
  ON emails
  FOR EACH ROW
  EXECUTE FUNCTION emails_search_vector_update();
```

Weight strategy:
- **A** (highest): subject -- most relevant for search
- **B**: sender name/address -- useful for "find emails from X"
- **C**: body text -- broad content match

Note: The existing `SearchIndex` model (token-based) can be dropped once tsvector is in place, as Postgres handles tokenization natively and more efficiently.

#### Step 2: Create search API endpoint

**File:** `apps/web/app/api/search/route.ts`

```
GET /api/search?q=<query>&status=<status>&tagId=<tagId>&mailboxId=<mailboxId>&limit=20&offset=0
```

Logic:
1. Auth check
2. Parse `q` into a tsquery (handle user input: quotes for phrase, OR, prefix matching with `:*`)
3. Query with raw SQL via `prisma.$queryRaw`:
   ```sql
   SELECT DISTINCT t.*,
     ts_rank(e.search_vector, query) AS relevance
   FROM threads t
   JOIN emails e ON e.thread_id = t.id
   CROSS JOIN plainto_tsquery('english', $1) query
   WHERE e.search_vector @@ query
     AND t.mailbox_id IN (...)
     [AND t.status = ...]
     [AND EXISTS (SELECT 1 FROM thread_tags tt WHERE tt.thread_id = t.id AND tt.tag_id IN (...))]
   ORDER BY relevance DESC, t.last_activity_at DESC
   LIMIT $2 OFFSET $3
   ```
4. Return threads with a `headline` snippet (Postgres `ts_headline` function) for each matching email:
   ```sql
   ts_headline('english', e.body_text, query,
     'StartSel=<mark>, StopSel=</mark>, MaxWords=35, MinWords=15')
   ```

Response shape:
```typescript
{
  threads: Thread[];          // Same shape as /api/threads response
  total: number;              // Total matching count for pagination
  highlights: Record<string, string>;  // threadId -> highlighted snippet
}
```

#### Step 3: Create `useSearch` hook

**File:** `apps/web/hooks/use-search.ts`

```typescript
export function useSearch(params: {
  query: string;
  status?: string;
  tagId?: string;
  mailboxId?: string;
  limit?: number;
  offset?: number;
}) { ... }
```

- Uses SWR with the search API URL
- Debounces the query (300ms) to avoid excessive requests while typing
- Returns `{ results, total, highlights, isLoading, isError }`
- Only fetches when `query.length >= 2`

#### Step 4: Create `<SearchBar>` component

**File:** `apps/web/components/inbox/search-bar.tsx`

Renders in the inbox header (part of / next to the filter toolbar).

Behavior:
- Text input with search icon, placeholder "Search emails..."
- On focus: expands to show a dropdown panel
- As user types (debounced): shows search results in the dropdown
- Each result shows: thread subject, sender, snippet with highlighted matches, tag badges, status badge
- Clicking a result navigates to `/thread/<id>`
- Keyboard navigation: arrow keys to move between results, Enter to open, Escape to close
- Shows result count and "Showing X of Y results"

States:
- Empty/idle: just the input
- Typing (< 2 chars): "Type at least 2 characters"
- Loading: spinner in dropdown
- Results: list of matching threads with snippets
- No results: "No emails matching '<query>'"

#### Step 5: Integrate search into filter toolbar

**File:** `apps/web/components/inbox/filter-toolbar.tsx`

Add the SearchBar as part of the toolbar, positioned at the right side. The search respects active filters (if you're viewing archived + tag X, search scopes to that).

#### Step 6: Search results page (optional enhancement)

**File:** `apps/web/app/(dashboard)/search/page.tsx`

For full-page search results with pagination. The search bar dropdown shows top 5-10 results with a "View all results" link that goes to this page.

This page reuses the ThreadList layout but powered by the search API instead of the threads API.

---

## Implementation Order

```
Phase 1: Filter Toolbar (steps 1-6)
  1.1  Update threads API for status=all and tag+status combo
  1.2  Create FilterToolbar component with status tabs
  1.3  Integrate toolbar into inbox page
  1.4  Add tag multi-select to full mode
  1.5  Add mailbox dropdown to full mode
  1.6  Add status badges to thread items

Phase 2: Keyword Search (steps 1-6)
  2.1  Database migration: tsvector column, GIN index, trigger
  2.2  Create /api/search endpoint with ts_rank and ts_headline
  2.3  Create useSearch hook with debounce
  2.4  Create SearchBar component with dropdown results
  2.5  Integrate search into filter toolbar
  2.6  (Optional) Full search results page with pagination
```

Phase 1 is self-contained and delivers immediate value for the archive/tag visibility problem. Phase 2 builds on top with the search bar slotting into the same toolbar.

---

## Files Changed/Created Summary

### Phase 1 (Filter Toolbar)
| Action | File |
|--------|------|
| Create | `apps/web/components/inbox/filter-toolbar.tsx` |
| Modify | `apps/web/app/api/threads/route.ts` |
| Modify | `apps/web/hooks/use-threads.ts` |
| Modify | `apps/web/app/(dashboard)/inbox/page.tsx` |
| Modify | `apps/web/components/inbox/thread-list.tsx` |
| Modify | `apps/web/components/inbox/thread-item.tsx` |

### Phase 2 (Search)
| Action | File |
|--------|------|
| Create | Prisma migration SQL |
| Create | `apps/web/app/api/search/route.ts` |
| Create | `apps/web/hooks/use-search.ts` |
| Create | `apps/web/components/inbox/search-bar.tsx` |
| Modify | `apps/web/components/inbox/filter-toolbar.tsx` |
| Create | `apps/web/app/(dashboard)/search/page.tsx` (optional) |
