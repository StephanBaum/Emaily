# Implementation Progress

Progress tracking for the Collaborative AI Email Client implementation.

See `docs/plans/2026-02-06-email-client-implementation.md` for the full plan.

---

## Phase 1: Project Setup & Infrastructure [COMPLETE]

### Task 1.1: Initialize Monorepo [DONE]
- Created pnpm workspace with turbo
- Files: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.nvmrc`

### Task 1.2: Create Next.js Web App [DONE]
- Next.js 14 with App Router
- Tailwind CSS with shadcn/ui-ready configuration
- Files: `apps/web/` - layout, page, tailwind config, postcss config

### Task 1.3: Create Shared Packages [DONE]
- `packages/shared/` - TypeScript types for User, Team, Mailbox, Thread, Email, Tag, etc.
- `packages/database/` - Database package shell (Prisma schema added in Phase 2)

### Task 1.4: Docker Development Environment [DONE]
- Docker Compose with PostgreSQL (pgvector), Redis, GreenMail
- Note: Ollama removed - using n8n webhooks for AI processing (more flexible)
- Files: `docker/docker-compose.yml`, `docker/.env.example`

### Task 1.5: Setup Testing Framework [DONE]
- Vitest configured at root and package level
- React Testing Library for web app
- Files: `vitest.config.ts`, `apps/web/vitest.config.ts`, `packages/*/vitest.config.ts`

---

## Phase 2: Database Schema & Core Models [COMPLETE]

### Task 2.1: Prisma Schema - Core Entities [DONE]
- Created comprehensive Prisma schema with all entities
- Models: Team, User, RefreshToken, Mailbox, MailboxAccess, MailboxSync, Thread, Email, Attachment, SearchIndex, Comment, Assignment, SeenBy, SharedDraft, DraftVersion, Tag, ThreadTag, EmailIntent, DraftRequirement, QAPair, Contact, ActivityLog
- PostgreSQL extensions: pgcrypto, vector (for pgvector)
- Schema pushed to database - 22 tables created
- Files:
  - `packages/database/prisma/schema.prisma`
  - `packages/database/src/client.ts`
  - `packages/database/src/index.ts`
  - `packages/database/.env`

### Task 2.2: Database Tests [DONE]
- Testcontainers integration for PostgreSQL (pgvector/pgvector:pg16)
- 10 tests covering: Team, User, Mailbox, Thread, Email, Tags, Comments, Assignments
- Files:
  - `packages/database/tests/setup.ts`
  - `packages/database/tests/models.test.ts`
  - `packages/database/vitest.config.ts`

---

## Phase 3: Authentication & Security [COMPLETE]

### Task 3.1: Security Package [DONE]
- Created `packages/security/` with comprehensive security utilities
- **Password utilities:** bcrypt hashing (12 rounds), strength validation with scoring
- **TOTP (2FA):** Secret generation, URI for authenticator apps, token verification
- **JWT Tokens:** Access tokens (15m expiry), refresh tokens (7d expiry), token hashing
- **Encryption:** AES-256-GCM for sensitive data (IMAP passwords), blind indexing
- 48 tests covering all security functions
- Files:
  - `packages/security/src/password.ts`
  - `packages/security/src/totp.ts`
  - `packages/security/src/tokens.ts`
  - `packages/security/src/encryption.ts`
  - `packages/security/tests/*.test.ts`

---

## Phase 4: Mail Engine (IMAP/SMTP) [COMPLETE]

### Task 4.1: Mail Engine Package [DONE]
- Created `packages/mail-engine/` with IMAP, SMTP, and thread matching utilities
- **IMAP Client:** ImapFlow-based client with connection management, folder listing, email fetching, searching, flag management
  - Handles reconnection by creating fresh ImapFlow instances
  - Mailbox locking for safe concurrent operations
  - Full email parsing with mailparser (body, headers, attachments)
- **SMTP Client:** Nodemailer-based client for sending emails
  - Supports plain text and HTML emails
  - Proper reply threading with In-Reply-To and References headers
  - CC/BCC support
- **Thread Matcher:** Email threading logic
  - Matches by In-Reply-To, References, or normalized subject
  - Normalizes subjects (removes Re:, Fwd:, [tags], international prefixes)
  - Thread chain building and participant extraction
  - Bot detection (noreply, notifications, system headers)
- **Mailbox Syncer:** Coordinates IMAP sync with database callbacks
  - Initial and incremental sync modes
  - Thread matching for incoming emails
  - Callback-based architecture for database storage
- 33 tests passing (1 skipped - ImapFlow lock contention with GreenMail)
- Files:
  - `packages/mail-engine/src/imap-client.ts`
  - `packages/mail-engine/src/smtp-client.ts`
  - `packages/mail-engine/src/thread-matcher.ts`
  - `packages/mail-engine/src/mailbox-syncer.ts`
  - `packages/mail-engine/src/index.ts`
  - `packages/mail-engine/tests/thread-matcher.test.ts`
  - `packages/mail-engine/tests/mail-integration.test.ts`

---

## Phase 5: Core UI - Inbox & Threads [COMPLETE]

### Task 5.1: shadcn/ui Setup [DONE]
- Installed shadcn/ui components (Button, Input, Label, Card, Avatar, Badge, Separator, DropdownMenu, Dialog, Tooltip, ScrollArea, Tabs, Skeleton)
- Configured Tailwind CSS with shadcn theme variables (colors, sidebar, radius)
- Created `lib/utils.ts` with `cn()` helper
- Files: `apps/web/components.json`, `apps/web/components/ui/*.tsx`

### Task 5.2: Authentication Setup [DONE]
- NextAuth v5 (beta) with credentials provider
- Integration with `@emailautomation/security` for password verification and TOTP
- JWT session strategy with custom user fields (teamId, role, etc.)
- Type-safe session with `next-auth.d.ts` module augmentation
- Files: `apps/web/lib/auth.ts`, `apps/web/app/api/auth/[...nextauth]/route.ts`

### Task 5.3: Prisma Client Setup [DONE]
- Prisma client re-exported from database package
- Environment configured with DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY
- Files: `apps/web/lib/prisma.ts`, `apps/web/.env.local`

### Task 5.4: Dashboard Layout with Sidebar [DONE]
- Protected layout with SessionProvider
- Sidebar with mailbox list, navigation (Inbox, Archived, Snoozed)
- User menu with sign-out
- Sync button for manual mail sync
- Auth middleware with callback URL support
- Files: `apps/web/app/(dashboard)/layout.tsx`, `apps/web/components/inbox/sidebar.tsx`, `apps/web/middleware.ts`

### Task 5.5: Inbox Page - Thread List [DONE]
- Thread list with SWR data fetching
- Thread item with sender, subject, preview, tags, assignments
- Unread indicator based on SeenBy status
- Empty state for no threads
- Files: `apps/web/app/(dashboard)/inbox/page.tsx`, `apps/web/components/inbox/thread-list.tsx`, `apps/web/components/inbox/thread-item.tsx`, `apps/web/hooks/use-threads.ts`

### Task 5.6: Thread Detail Page [DONE]
- Email chain view with all messages in chronological order
- Expandable/collapsible email messages
- Header with archive, snooze, tag actions
- Sender info, date, recipients display
- Attachment list display
- Auto-mark as seen on view
- Files: `apps/web/app/(dashboard)/thread/[id]/page.tsx`, `apps/web/components/thread/email-chain.tsx`, `apps/web/components/thread/email-message.tsx`, `apps/web/components/thread/thread-header.tsx`

### Task 5.7: Reply Composer [DONE]
- Expandable reply form
- Auto-populated reply-to address
- Send button with loading state
- Integration with SMTP client for sending
- Files: `apps/web/components/thread/reply-composer.tsx`

### Task 5.8: API Routes [DONE]
- `GET /api/mailboxes` - User's accessible mailboxes with thread counts
- `GET /api/threads` - Thread list with filtering by mailbox/status
- `GET /api/threads/[id]` - Single thread with emails, comments, assignments
- `PATCH /api/threads/[id]` - Update thread status
- `POST /api/emails/send` - Send email via SMTP
- All routes verify session and check mailbox access
- Files: `apps/web/app/api/mailboxes/route.ts`, `apps/web/app/api/threads/route.ts`, `apps/web/app/api/threads/[id]/route.ts`, `apps/web/app/api/emails/send/route.ts`

### Task 5.9: Manual Sync [DONE]
- `POST /api/sync` - Trigger IMAP sync for all accessible mailboxes
- Uses MailboxSyncer with database callbacks
- Returns sync results per mailbox
- Files: `apps/web/app/api/sync/route.ts`

### Database Seed Script [DONE]
- Creates test team, user (test@example.com / password123), mailbox
- Connects to GreenMail test server
- Sample tags and welcome thread
- Files: `packages/database/prisma/seed.ts`

### Breaking Changes from Phase 3-4
- Switched from native `bcrypt` to `bcryptjs` for Next.js bundling compatibility
- Fixed IMAP client bigint handling for uidValidity

---

## Phase 6: Collaboration Features [COMPLETE]

### Task 6.1: Collaboration Side Panel [DONE]
- Created collapsible side panel for team collaboration
- Panel contains: Assignments, Comments, Seen By sections
- Collapsed state persists in localStorage
- Updated thread detail page to side-by-side layout
- Files:
  - `apps/web/components/thread/collaboration-panel.tsx`
  - `apps/web/app/(dashboard)/thread/[id]/page.tsx` (refactored layout)

### Task 6.2: Assignments API [DONE]
- `GET /api/threads/[id]/assignments` - List assignments for thread
- `POST /api/threads/[id]/assignments` - Create assignment
- `PATCH /api/threads/[id]/assignments/[assignmentId]` - Update status/note/dueDate
- `DELETE /api/threads/[id]/assignments/[assignmentId]` - Remove assignment
- `GET /api/team-members` - List team members for picker
- All routes verify mailbox access and team membership
- Files:
  - `apps/web/app/api/threads/[id]/assignments/route.ts`
  - `apps/web/app/api/threads/[id]/assignments/[assignmentId]/route.ts`
  - `apps/web/app/api/team-members/route.ts`

### Task 6.3: Assignments UI [DONE]
- Assignment section in collaboration panel
- Team member picker dropdown
- Status badges (open, in_progress, done)
- Status change dropdown
- Remove assignment functionality
- Files: `apps/web/components/thread/assignment-section.tsx`

### Task 6.4: Shared Drafts API [DONE]
- `POST /api/shared-drafts` - Create draft (auto-acquires lock)
- `GET /api/shared-drafts/[id]` - Get draft with lock status
- `PATCH /api/shared-drafts/[id]` - Update body (requires lock, auto-saves version)
- `DELETE /api/shared-drafts/[id]` - Delete draft
- `POST /api/shared-drafts/[id]/lock` - Acquire/refresh lock (30 min expiry)
- `DELETE /api/shared-drafts/[id]/lock` - Release lock
- `GET /api/shared-drafts/[id]/versions` - Version history
- `POST /api/shared-drafts/[id]/versions` - Restore a version
- Files:
  - `apps/web/app/api/shared-drafts/route.ts`
  - `apps/web/app/api/shared-drafts/[id]/route.ts`
  - `apps/web/app/api/shared-drafts/[id]/lock/route.ts`
  - `apps/web/app/api/shared-drafts/[id]/versions/route.ts`

### Task 6.5: Shared Drafts UI [DONE]
- SharedDraftComposer replaces ReplyComposer for drafts
- Lock indicator (who has lock)
- Auto-save with 30s debounce (creates versions)
- Lock acquire/release controls
- Version history panel with preview and restore
- Integration with send flow
- Files:
  - `apps/web/components/thread/shared-draft-composer.tsx`
  - `apps/web/components/thread/draft-version-history.tsx`

### Task 6.6: Updated Existing Components [DONE]
- CommentSection: Added `compact` prop for panel display
- SeenByIndicator: Added `compact` prop for vertical list in panel
- Files:
  - `apps/web/components/thread/comment-section.tsx`
  - `apps/web/components/thread/seen-by-indicator.tsx`

---

## Phase 6.5: Test Email Data (AI Preparation) [COMPLETE]

### Task 6.5.1: Diverse Email Seed Script [DONE]
- Created `packages/database/prisma/seed-emails.ts` with 19 threads / ~30 emails
- Added `pnpm db:seed:emails` script to `packages/database/package.json`
- Covers email categories: newsletter, promo/sale, SaaS notifications (password reset, GitHub PR, LinkedIn), shipping, client support (threaded), sales inquiry (threaded), bug report (threaded), feature request, meeting/calendar, cold outreach/spam, internal team discussion (threaded), contract/legal, personal/casual, security alert, client onboarding (threaded), GDPR/compliance
- Added 9 additional tags for better AI classification coverage: Billing, Feature Request, Bug Report, Notification, Onboarding, Legal, Internal, Spam, Personal
- All emails include both bodyText and bodyHtml; marketing emails have rich HTML layouts
- Threaded conversations include proper inReplyTo/references chains and isSent flags

**Usage:**
```bash
cd packages/database
pnpm db:seed          # first: create team, user, mailbox, base tags
pnpm db:seed:emails   # then: populate with diverse test emails
```

---

## Phase 6.6: Tag Management & Thread Tagging [COMPLETE]

### Task 6.6.1: Tag CRUD API [DONE]
- `GET /api/tags` — List all team tags with thread counts
- `POST /api/tags` — Create tag (name, color, aiAction)
- `PATCH /api/tags/[id]` — Update tag (name, color, aiAction, active)
- `DELETE /api/tags/[id]` — Delete tag (cascades ThreadTag)
- Duplicate name detection (409 on conflict)
- Files:
  - `apps/web/app/api/tags/route.ts`
  - `apps/web/app/api/tags/[id]/route.ts`

### Task 6.6.2: Thread Tag API [DONE]
- `POST /api/threads/[id]/tags` — Add tag to thread (upsert, appliedBy: "manual")
- `DELETE /api/threads/[id]/tags?tagId=...` — Remove tag from thread
- Both verify mailbox access and team ownership
- Files: `apps/web/app/api/threads/[id]/tags/route.ts`

### Task 6.6.3: Tag Management Page [DONE]
- Full CRUD UI at `/tags` with create/edit dialog
- Color picker with 12 preset colors and live preview
- AI action dropdown (none, draft, research_draft, auto_reply, archive, notify)
- Thread count per tag, inline delete with confirmation
- Files: `apps/web/app/(dashboard)/tags/page.tsx`

### Task 6.6.4: Tag Picker on Thread Header [DONE]
- Replaced static tag badges with interactive TagPicker component
- Popover with checkbox-style list of all team tags
- Add/remove tags with optimistic updates
- Hover-to-reveal X button on applied tags for quick removal
- Files: `apps/web/components/thread/tag-picker.tsx`, `apps/web/components/thread/thread-header.tsx`

### Task 6.6.5: Sidebar Tag List [DONE]
- Sidebar now shows all tags with colored dots and thread counts
- "Manage" link in section header
- Uses `useTags` SWR hook for data fetching
- Files: `apps/web/components/inbox/sidebar.tsx`, `apps/web/hooks/use-tags.ts`

---

## Phase 6.7: Filter Toolbar & Full-Text Search [IN PROGRESS]

Plan: `docs/plans/2026-02-07-filters-and-search.md`

### Filter Toolbar (`feature/filter-toolbar` branch) [DONE]
- Updated `/api/threads` to support `status=all` and smart defaults (tag view shows all statuses)
- Created `FilterToolbar` component with status tabs (All/Open/Archived/Snoozed), tag multi-select popover, mailbox dropdown
- Two modes: full mode (inbox) and simplified mode (tag view — status tabs only)
- Integrated toolbar into inbox page header
- Added status icons (Archive/Clock) on thread items when viewing mixed statuses
- Updated `useThreads` hook and `ThreadList` to pass `status=all` correctly
- Commit: `a69d0f2`
- Files:
  - `apps/web/components/inbox/filter-toolbar.tsx` (new)
  - `apps/web/app/api/threads/route.ts` (modified)
  - `apps/web/hooks/use-threads.ts` (modified)
  - `apps/web/app/(dashboard)/inbox/page.tsx` (modified)
  - `apps/web/components/inbox/thread-list.tsx` (modified)
  - `apps/web/components/inbox/thread-item.tsx` (modified)

### Full-Text Search (`feature/search` branch) [DONE]
- SQL migration: tsvector column on emails, GIN index, auto-update trigger (weighted: A=subject, B=sender, C=body)
- Created `/api/search` endpoint with `ts_rank` relevance scoring and `ts_headline` snippets
- Created `useSearch` hook with 300ms debounce and SWR caching (min 2 chars)
- Created `SearchBar` component with dropdown results, keyboard navigation, highlighted snippets
- Integrated SearchBar into inbox page header
- Commit: `cd50c6a`
- Files:
  - `packages/database/prisma/migrations/001_add_search_vector.sql` (new)
  - `apps/web/app/api/search/route.ts` (new)
  - `apps/web/hooks/use-search.ts` (new)
  - `apps/web/components/inbox/search-bar.tsx` (new)
  - `apps/web/app/(dashboard)/inbox/page.tsx` (modified)

**Deployment note:** Run the tsvector migration SQL against PostgreSQL before deploying the search feature.

---

## Phase 7: AI Integration [IN PROGRESS]

Plan: `docs/plans/2026-02-09-phase7-ai-integration.md`
Branch: `feature/ai-integration`

### Sub-Phase 7.1: AI Engine Package + Provider Abstraction [DONE]
- Created `packages/ai-engine/` workspace package
- Provider interface: `AIProvider` with `complete()`, `embed()`, `isAvailable()`
- Gemini provider: `@google/generative-ai` SDK, model `gemini-2.5-flash`, embeddings `text-embedding-004`
- Ollama provider: REST API via `fetch`, model `llama3.2`, embeddings `nomic-embed-text`
- Config factory: `createProviderFromEnv()` auto-detects from `GEMINI_API_KEY` / `OLLAMA_HOST`
- Added shared types: `TagRuleCondition`, `TagAutoRules`, `AIProcessingResult`
- Files:
  - `packages/ai-engine/package.json`, `tsconfig.json`
  - `packages/ai-engine/src/providers/provider.ts` (interface)
  - `packages/ai-engine/src/providers/gemini-provider.ts`
  - `packages/ai-engine/src/providers/ollama-provider.ts`
  - `packages/ai-engine/src/config.ts`
  - `packages/ai-engine/src/index.ts`
  - `packages/shared/src/types/index.ts` (modified)

### Sub-Phase 7.2: Auto-Tagging Pipeline [DONE]
- Two-layer system: deterministic rules first, then LLM classification for unmatched tags
- Rules engine: field/operator/value conditions with AND/OR logic
- LLM classification: prompt-based tag assignment with confidence scoring
- Added `autoRules` to tag PATCH endpoint
- Files:
  - `packages/ai-engine/src/prompts/auto-tag.ts`
  - `packages/ai-engine/src/pipeline/auto-tagger.ts`
  - `apps/web/app/api/tags/[id]/route.ts` (modified)

### Sub-Phase 7.3: Intent Extraction Pipeline [DONE]
- Decomposes emails into question/request/info intents with priority 1-3
- Thread context awareness: summarizes previous emails for context
- Validation: enforces schema, limits to 10 intents, sanitizes text
- Files:
  - `packages/ai-engine/src/prompts/intent-extraction.ts`
  - `packages/ai-engine/src/pipeline/intent-extractor.ts`

### Sub-Phase 7.4: Draft Generation Pipeline [DONE]
- Confidence-based draft generation addressing extracted intents
- Q&A pair matching: finds relevant pairs by intent text overlap
- Confidence scoring: overall, intentCoverage, qaMatchStrength, ragRelevance, toneConsistency
- Files:
  - `packages/ai-engine/src/prompts/draft-generation.ts`
  - `packages/ai-engine/src/pipeline/draft-generator.ts`

### Sub-Phase 7.5: BullMQ Worker + API Integration [DONE]
- AI worker: `workers/ai-worker/` with BullMQ processor (concurrency 3, rate limit 10/min, 3 retries)
- Queue client: `enqueueEmailForAI()` for web app to add jobs
- AI service layer: `processEmailWithAI()` orchestrates full pipeline
- API endpoints:
  - `POST /api/ai/process` — manually trigger AI processing for email/thread
  - `GET /api/ai/status` — provider health check
  - `GET /api/threads/[id]/intents` — fetch intents for thread
- Sync route wired: `addEmailToThread` and `createThread` callbacks enqueue AI jobs
- Added deps to web app: `@emailautomation/ai-engine`, `bullmq`, `ioredis`
- Files:
  - `workers/ai-worker/package.json`, `tsconfig.json`
  - `workers/ai-worker/src/index.ts`, `processor.ts`, `queues.ts`
  - `apps/web/lib/ai-queue.ts`, `apps/web/lib/ai.ts`
  - `apps/web/app/api/ai/process/route.ts`
  - `apps/web/app/api/ai/status/route.ts`
  - `apps/web/app/api/threads/[id]/intents/route.ts`
  - `apps/web/app/api/sync/route.ts` (modified)
  - `apps/web/package.json` (modified)
  - `apps/web/tsconfig.json` (modified)

### Sub-Phase 7.6: Minimal UI Integration [DONE]
- IntentPanel component: displays extracted intents grouped by type, color-coded, priority badges
- Integrated into thread detail page collaboration panel (AI Intents section)
- AI tag badge: Sparkles icon on thread-item tags where `appliedBy === "ai"`
- Files:
  - `apps/web/components/thread/intent-panel.tsx`
  - `apps/web/app/(dashboard)/thread/[id]/page.tsx` (modified)
  - `apps/web/components/inbox/thread-item.tsx` (modified)

### Sub-Phase 7.7: AI Integration Overhaul — Action Execution & Bulk Processing [DONE]
- Extended shared types: `actionsExecuted` on `AIProcessingResult`, `AIActionExecuted`, `AIBulkProcessingResult`, AI activity actions
- Major rewrite of `apps/web/lib/ai.ts`:
  - `logAIActivity()` — writes ActivityLog with userId: null for AI actions
  - `sendAutoReply()` — fetches mailbox SMTP config, sends via SmtpClient.sendReply(), saves sent email
  - `processAllEmailsWithAI()` — bulk processes all emails without EmailIntent records
  - Tag action execution: archive (thread status), auto_reply (rule-matched only, confidence 1.0), notify (activity log), draft/research_draft (generate + log)
- New API routes:
  - `POST /api/ai/process-all` — bulk AI processing endpoint
  - `GET /api/threads/[id]/ai-activity` — AI activity log for thread
- Replaced IntentPanel with AIActivityPanel:
  - Shows tagged/draft/auto-replied/archived/notified actions with icons and timestamps
  - Keeps "Analyze with AI" manual trigger button
- Thread page: swapped IntentPanel → AIActivityPanel, passes confidence/lockType to composer
- SharedDraftComposer AI draft indicators:
  - AI Draft badge with Sparkles icon and confidence percentage
  - Emerald-tinted background on textarea for AI-generated content (clears on edit)
- Sidebar enhancements:
  - "Process All with AI" button with progress state
  - Auto-triggers AI processing after sync when new emails arrive
- Cleaned up sync route: removed dead `enqueueEmailForAI` calls
- Updated process endpoint response to include `actionsExecuted`
- Build passes
- Files:
  - `packages/shared/src/types/index.ts` (modified)
  - `apps/web/lib/ai.ts` (major rewrite)
  - `apps/web/app/api/ai/process-all/route.ts` (new)
  - `apps/web/app/api/threads/[id]/ai-activity/route.ts` (new)
  - `apps/web/components/thread/ai-activity-panel.tsx` (new)
  - `apps/web/app/(dashboard)/thread/[id]/page.tsx` (modified)
  - `apps/web/components/thread/shared-draft-composer.tsx` (modified)
  - `apps/web/components/inbox/sidebar.tsx` (modified)
  - `apps/web/app/api/sync/route.ts` (modified)
  - `apps/web/app/api/ai/process/route.ts` (modified)

### Sub-Phase 7.8: Unified Single-Call AI + Agent System [DONE]
- **Goal:** 1 LLM call per thread (not per email), configurable agents, "Draft with Agent" in composer
- Database: Added `Agent` and `AgentTagWatch` models, `agentId` FK on `SharedDraft`
- Shared types: Added `Agent`, `AgentTagWatch`, `UnifiedAIResult` types, updated `AIProcessingResult` (`emailId` → `threadId`, added `agentId`/`agentName`)
- AI Engine: New `UnifiedThreadProcessor` class with single-call prompt for tags + intents + draft
  - `packages/ai-engine/src/prompts/unified-thread.ts` — combined prompt (tag classification, intent extraction, draft generation)
  - `packages/ai-engine/src/pipeline/unified-thread-processor.ts` — single `provider.complete()` call, JSON validation, graceful fallback
- Orchestration rewrite: `processThreadWithAI()` replaces per-email processing
  1. Fetch thread with ALL emails
  2. Deterministic rule matching (0 LLM calls)
  3. Agent resolution (explicit → default → null)
  4. Single LLM call via `UnifiedThreadProcessor`
  5. Batch tag writes, intent save, draft creation with `agentId`
  6. Tag action execution (archive, auto_reply, notify, draft)
  - `processEmailWithAI()` → thin wrapper resolving to thread
  - `processAllThreadsWithAI()` → thread-based bulk with batches of 5
- API routes:
  - `POST /api/ai/process` — accepts optional `agentId`, thread-based processing
  - `POST /api/ai/process-all` — calls `processAllThreadsWithAI()`
  - `GET /api/agents` — list team agents
  - `POST /api/agents` — create agent (with tag watches)
  - `PATCH /api/agents/[id]` — update agent
  - `DELETE /api/agents/[id]` — delete agent (default agent protected)
- UI:
  - `useAgents` SWR hook (`apps/web/hooks/use-agents.ts`)
  - AIActivityPanel: agent selector dropdown next to "Analyze with AI" button, agent name in results
  - SharedDraftComposer: "Draft with AI" dropdown in collapsed state, agent name on AI Draft badge
  - Agent settings CRUD page (`/settings/agents`) with name, role, system prompt, temperature slider, active/default toggles
  - Sidebar: "AI Agents" link in user dropdown menu
- Verification: `tsc --noEmit` passes for web app, Prisma schema valid, db:push succeeded
- Files:
  - `packages/database/prisma/schema.prisma` (Agent, AgentTagWatch models, SharedDraft.agentId)
  - `packages/shared/src/types/index.ts` (Agent, AgentTagWatch, UnifiedAIResult types)
  - `packages/ai-engine/src/prompts/unified-thread.ts` (new)
  - `packages/ai-engine/src/pipeline/unified-thread-processor.ts` (new)
  - `packages/ai-engine/src/index.ts` (exports)
  - `apps/web/lib/ai.ts` (major rewrite — thread-based)
  - `apps/web/app/api/ai/process/route.ts` (updated)
  - `apps/web/app/api/ai/process-all/route.ts` (updated)
  - `apps/web/app/api/agents/route.ts` (new)
  - `apps/web/app/api/agents/[id]/route.ts` (new)
  - `apps/web/hooks/use-agents.ts` (new)
  - `apps/web/components/thread/ai-activity-panel.tsx` (updated)
  - `apps/web/components/thread/shared-draft-composer.tsx` (updated)
  - `apps/web/app/(dashboard)/thread/[id]/page.tsx` (updated)
  - `apps/web/app/(dashboard)/settings/agents/page.tsx` (new)
  - `apps/web/components/inbox/sidebar.tsx` (updated)

### Sub-Phase 7.9: Bug Fixes — Live Updates, Tag/Draft/Action Correctness [DONE]
- **Test email injection fix:** Rewrote `test-email-injector.ts` to use nodemailer directly without auth (GreenMail accepts unauthenticated SMTP on port 3025); sync route calls injector before IMAP sync in dev mode
- **Tag accumulation fix:** `processThreadWithAI()` now clears stale AI-applied tags (tags present on thread but not in new LLM result) before upserting new ones, in a single `prisma.$transaction`
- **Draft replacement fix:** When an existing SharedDraft exists, now updates its content/agentId instead of skipping creation — allows switching agents to regenerate drafts
- **Action re-firing fix:** Tag actions (archive, notify, auto_reply) now only execute on newly matched tags from the current run, not on all previously applied tags
- **Live updates — SharedDraftComposer:** Added `useEffect` to sync `existingDraft` prop changes into local state (draft, body, mode, expanded); polling `router.refresh()` 5x after "Draft with AI" succeeds
- **Live updates — AIActivityPanel:** Replaced one-shot fetch with continuous polling (5s idle, 2s while processing); auto-calls `router.refresh()` when activity count changes to propagate tag/draft/intent updates across the entire page
- **Type fixes:** Added `@types/nodemailer` to web app, `@types/node` + `typescript` to ai-engine; both packages pass `tsc --noEmit`
- Files:
  - `apps/web/lib/test-email-injector.ts` (rewritten)
  - `apps/web/app/api/sync/route.ts` (modified — inject before sync)
  - `apps/web/lib/ai.ts` (tag cleanup, draft update, action scoping)
  - `apps/web/components/thread/shared-draft-composer.tsx` (useEffect sync + polling)
  - `apps/web/components/thread/ai-activity-panel.tsx` (continuous polling + auto-refresh)
  - `apps/web/package.json` (added @types/nodemailer)
  - `packages/ai-engine/package.json` (added @types/node, typescript)

---

## Phase 7.10: Spam Defense & Sender Trust [DONE]

Branch: `feature/spam-defense` → merged into `feature/ai-integration`

### Schema + Types
- Added `trustLevel`, `interactionCount`, `repliedToCount`, `domain` to Contact model
- Added `spamScore`, `spamAnalysis` (Json) to Email model
- Added `senderTrustLevel` to Thread model
- Added `minTrustLevel` to Tag model (gates AI tag application)
- Added `TrustLevel`, `TRUST_LEVEL_ORDER`, `SpamAnalysisResult` types
- Added `"quarantined"` to `ThreadStatus`

### Spam Analyzer (`packages/mail-engine/src/spam-analyzer.ts`)
- Pure-function header analysis: SPF/DKIM/DMARC, SpamAssassin, Google headers, From/Reply-To mismatch, bulk precedence
- Weighted scoring 0.0-1.0, thresholds: >=0.7 quarantine, 0.4-0.7 suspicious

### Contact & Trust Management (`apps/web/lib/contacts.ts`)
- `upsertContactFromEmail()` — auto-learn contacts, start as "known"
- `elevateTrustOnReply()` — upgrade to "trusted" when team replies
- `getSenderTrustLevel()` — lookup or "stranger" if unknown
- `PATCH /api/contacts/[id]/trust` — manual trust override (only way to set VIP)
- `POST /api/contacts/elevate-trust` — client-callable trust elevation

### Sync Integration
- Spam analysis on every incoming email (addEmailToThread + createThread)
- Contact auto-learning on every sync
- Quarantine threads with spamScore >= 0.7
- Cache senderTrustLevel on new threads

### Trust-Gated AI Processing
- Quarantine gate: `processThreadWithAI()` returns early for quarantined threads
- Tag filtering: only AI-applies tags where sender meets `minTrustLevel`
- Auto-reply block: skips auto_reply for senders below "trusted"
- Trust context injected into LLM prompt (sender trust description)
- Bulk processing skips quarantined threads

### Trust Elevation on Reply
- `sendAutoReply()` in ai.ts elevates trust after successful send
- Reply composer and shared draft composer fire-and-forget `/api/contacts/elevate-trust`

### UI
- Sidebar: "Spam" nav item (`ShieldAlert` icon, `?status=quarantined`)
- Thread list: `ShieldQuestion` (orange) for strangers, `Crown` (amber) for VIP contacts
- Thread detail: Sender info panel with trust selector, spam score bar, "Mark as Not Spam"
- Tag management: `minTrustLevel` dropdown (Any sender / Known / Trusted / VIP only)
- `PATCH /api/threads/[id]/status` — thread status change route

### Files
- `packages/database/prisma/schema.prisma` (Contact, Email, Thread, Tag fields)
- `packages/shared/src/types/index.ts` (TrustLevel, SpamAnalysisResult, ThreadStatus)
- `packages/mail-engine/src/spam-analyzer.ts` (new)
- `packages/mail-engine/src/index.ts` (exports)
- `apps/web/lib/contacts.ts` (new)
- `apps/web/app/api/contacts/[id]/trust/route.ts` (new)
- `apps/web/app/api/contacts/elevate-trust/route.ts` (new)
- `apps/web/app/api/threads/[id]/status/route.ts` (new)
- `apps/web/app/api/sync/route.ts` (modified)
- `apps/web/lib/ai.ts` (modified — trust gating)
- `packages/ai-engine/src/pipeline/unified-thread-processor.ts` (ThreadContext.senderTrust)
- `packages/ai-engine/src/prompts/unified-thread.ts` (senderTrust in prompt)
- `apps/web/components/inbox/sidebar.tsx` (Spam nav)
- `apps/web/components/inbox/thread-item.tsx` (trust icons)
- `apps/web/components/thread/sender-info-panel.tsx` (new)
- `apps/web/app/(dashboard)/thread/[id]/page.tsx` (sender panel integration)
- `apps/web/app/(dashboard)/tags/page.tsx` (minTrustLevel field)
- `apps/web/app/api/tags/route.ts` (minTrustLevel)
- `apps/web/app/api/tags/[id]/route.ts` (minTrustLevel)
- `apps/web/components/thread/reply-composer.tsx` (trust elevation)
- `apps/web/components/thread/shared-draft-composer.tsx` (trust elevation)

---

## Phase 8: Polish & Production [PENDING]

---

## Verification Status

| Phase | Status | Verification |
|-------|--------|--------------|
| 1 | COMPLETE | `pnpm dev` starts, `pnpm test` passes |
| 2 | COMPLETE | Schema pushed, 10 database tests pass |
| 3 | COMPLETE | 48 security tests pass |
| 4 | COMPLETE | 33 mail-engine tests pass (1 skipped) |
| 5 | COMPLETE | Build passes, dev server runs, 91 tests pass |
| 6 | COMPLETE | Build passes, collaboration panel, assignments, shared drafts working |
| 7-8 | PENDING | - |

---

## Test Summary

Total: **93 tests passing** (1 skipped)
- database: 10 tests
- security: 48 tests
- mail-engine: 33 tests (1 skipped)
- web: 2 tests

Run all tests: `pnpm test`
