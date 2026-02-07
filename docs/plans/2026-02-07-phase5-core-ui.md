# Phase 5: Core UI - Inbox & Threads

> **For Claude:** This plan builds on Phases 1-4. Review what exists before implementing.

**Goal:** Create a functional email client UI that connects to all backend packages built in Phases 1-4.

**What We Have (Phases 1-4):**

| Phase | Package | What It Provides |
|-------|---------|------------------|
| 1 | `apps/web` | Next.js 14, Tailwind, shadcn-ready config |
| 1 | `docker/` | PostgreSQL (pgvector), Redis, GreenMail |
| 2 | `packages/database` | Prisma schema: Team, User, Mailbox, Thread, Email, Tag, Comment, Assignment, etc. |
| 3 | `packages/security` | `hashPassword`, `verifyPassword`, `generateTotpSecret`, `verifyTotpToken`, `generateAccessToken`, `generateRefreshToken`, `encrypt`, `decrypt` |
| 4 | `packages/mail-engine` | `ImapClient`, `SmtpClient`, `matchEmailToThread`, `normalizeSubject`, `isLikelyBot`, `MailboxSyncer` |

---

## Architecture Overview

```
apps/web/
├── app/
│   ├── (auth)/              # Auth pages (public)
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/         # Protected pages
│   │   ├── inbox/page.tsx
│   │   ├── thread/[id]/page.tsx
│   │   └── layout.tsx       # Sidebar + auth guard
│   ├── api/                  # API routes
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── mailboxes/route.ts
│   │   ├── threads/route.ts
│   │   └── emails/route.ts
│   ├── layout.tsx
│   └── page.tsx             # Redirect to /inbox
├── components/
│   ├── ui/                  # shadcn components
│   ├── inbox/               # Inbox-specific
│   │   ├── sidebar.tsx
│   │   ├── thread-list.tsx
│   │   └── thread-item.tsx
│   ├── thread/              # Thread view
│   │   ├── email-chain.tsx
│   │   ├── email-message.tsx
│   │   └── reply-composer.tsx
│   └── auth/
│       └── login-form.tsx
├── lib/
│   ├── auth.ts              # NextAuth config
│   ├── prisma.ts            # Prisma client import
│   └── mail.ts              # Mail engine helpers
└── hooks/
    ├── use-threads.ts
    └── use-mailboxes.ts
```

---

## Task 5.1: Install shadcn/ui Components

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/components/ui/*.tsx` (Button, Input, Card, Avatar, Badge, etc.)
- Modify: `apps/web/tailwind.config.ts`
- Create: `apps/web/lib/utils.ts`

**Components needed:**
- Button, Input, Label, Card, Avatar, Badge, Separator
- DropdownMenu, Dialog, Tooltip
- ScrollArea, Tabs
- Skeleton (for loading states)

**Install command:**
```bash
cd apps/web
pnpm dlx shadcn@latest init
pnpm dlx shadcn@latest add button input label card avatar badge separator dropdown-menu dialog tooltip scroll-area tabs skeleton
```

---

## Task 5.2: Authentication Setup

**Files:**
- Create: `apps/web/lib/auth.ts` - NextAuth configuration
- Create: `apps/web/app/api/auth/[...nextauth]/route.ts`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/components/auth/login-form.tsx`

**Integration points:**
- Use `@emailautomation/database` for User lookup
- Use `@emailautomation/security` for:
  - `verifyPassword(password, user.passwordHash)` - login validation
  - `verifyTotpToken(user.totpSecret, token)` - 2FA if enabled
  - `generateAccessToken(payload)` - JWT for session

**Auth flow:**
1. User enters email/password
2. Lookup user in database by email
3. Verify password with `verifyPassword()`
4. If `user.totpEnabled`, prompt for TOTP code
5. Verify TOTP with `verifyTotpToken()`
6. Create session with NextAuth

---

## Task 5.3: Prisma Client Setup in Web App

**Files:**
- Create: `apps/web/lib/prisma.ts`
- Modify: `apps/web/.env.local`

**Code:**
```typescript
// apps/web/lib/prisma.ts
import { prisma } from "@emailautomation/database";
export { prisma };
```

**Environment:**
```env
DATABASE_URL="postgresql://emailautomation:emailautomation@localhost:5432/emailautomation"
```

---

## Task 5.4: Dashboard Layout with Sidebar

**Files:**
- Create: `apps/web/app/(dashboard)/layout.tsx` - Protected layout with sidebar
- Create: `apps/web/components/inbox/sidebar.tsx` - Mailbox list sidebar
- Create: `apps/web/middleware.ts` - Auth protection

**Sidebar displays:**
- User mailboxes from `prisma.mailbox.findMany({ where: ... })`
- Filter by `mailboxAccess` for current user
- Unread counts per mailbox

**Integration:**
- Database: `Mailbox`, `MailboxAccess`, `Thread` (for unread counts)

---

## Task 5.5: Inbox Page - Thread List

**Files:**
- Create: `apps/web/app/(dashboard)/inbox/page.tsx`
- Create: `apps/web/components/inbox/thread-list.tsx`
- Create: `apps/web/components/inbox/thread-item.tsx`
- Create: `apps/web/hooks/use-threads.ts`

**Display per thread:**
- Subject (from `Thread.subject`)
- Sender (from first `Email.fromAddress`)
- Preview (truncated `Email.bodyText`)
- Date (`Thread.lastActivityAt`)
- Tags (`ThreadTag` joined with `Tag`)
- Assignee avatar (`Assignment.assignedTo`)
- Unread indicator (`SeenBy` check)

**Query:**
```typescript
const threads = await prisma.thread.findMany({
  where: { mailboxId, status: "open" },
  orderBy: { lastActivityAt: "desc" },
  include: {
    emails: { orderBy: { date: "desc" }, take: 1 },
    tags: { include: { tag: true } },
    assignments: { include: { assignedTo: true } },
    seenBy: { where: { userId: currentUserId } },
  },
});
```

---

## Task 5.6: Thread Detail Page

**Files:**
- Create: `apps/web/app/(dashboard)/thread/[id]/page.tsx`
- Create: `apps/web/components/thread/email-chain.tsx`
- Create: `apps/web/components/thread/email-message.tsx`
- Create: `apps/web/components/thread/thread-header.tsx`

**Display:**
- All emails in thread chronologically
- Sender name, avatar, date per email
- Body text (or sanitized HTML)
- Attachments list
- Bot indicator (`Email.isBot`)

**Integration:**
- Database: `Thread`, `Email`, `Attachment`
- On view: Update `SeenBy` for current user

---

## Task 5.7: Reply Composer

**Files:**
- Create: `apps/web/components/thread/reply-composer.tsx`
- Create: `apps/web/app/api/emails/send/route.ts`

**Features:**
- Rich text editor (TipTap or simple textarea initially)
- To/CC/BCC fields (pre-filled from thread)
- Send button

**Integration:**
- Use `@emailautomation/mail-engine` `SmtpClient.sendReply()`:
  ```typescript
  const smtpClient = new SmtpClient({
    host: mailbox.smtpHost,
    port: mailbox.smtpPort,
    auth: { user: mailbox.smtpUser, pass: decryptedPassword },
  });

  await smtpClient.sendReply(
    lastEmail.messageId,
    lastEmail.references,
    { from, to, subject, text, html }
  );
  ```
- Use `@emailautomation/security` `decrypt()` for SMTP password
- Save sent email to database with `isSent: true`

---

## Task 5.8: API Routes

**Files:**
- Create: `apps/web/app/api/mailboxes/route.ts` - GET mailboxes
- Create: `apps/web/app/api/threads/route.ts` - GET/PATCH threads
- Create: `apps/web/app/api/threads/[id]/route.ts` - GET single thread
- Create: `apps/web/app/api/emails/send/route.ts` - POST send email

**All routes should:**
1. Verify session (NextAuth `getServerSession`)
2. Check user has access to requested mailbox
3. Use Prisma for database operations
4. Return JSON responses

---

## Task 5.9: Manual Sync Trigger (Temporary)

Until we have background workers, add a manual sync button.

**Files:**
- Create: `apps/web/app/api/sync/route.ts`
- Modify: `apps/web/components/inbox/sidebar.tsx` - Add sync button

**Integration:**
- Use `@emailautomation/mail-engine` `MailboxSyncer`:
  ```typescript
  const imapClient = new ImapClient({ ... });
  const syncer = new MailboxSyncer(imapClient, {
    onNewEmail: async (email, threadId) => {
      await prisma.email.create({ data: { ...email, threadId } });
    },
    onNewThread: async (thread) => {
      return (await prisma.thread.create({ data: thread })).id;
    },
    getExistingThreads: async () => {
      return prisma.thread.findMany({ ... });
    },
  });
  await syncer.syncFolder("INBOX");
  ```
- Use `@emailautomation/security` `decrypt()` for IMAP password

---

## Implementation Order

1. **Task 5.1** - shadcn/ui setup (foundation)
2. **Task 5.3** - Prisma client in web app
3. **Task 5.2** - Authentication (needed for everything)
4. **Task 5.4** - Dashboard layout + sidebar
5. **Task 5.5** - Thread list
6. **Task 5.6** - Thread detail
7. **Task 5.7** - Reply composer
8. **Task 5.8** - API routes
9. **Task 5.9** - Manual sync

---

## Testing Plan

| What | How |
|------|-----|
| Login flow | Manual test with seeded user |
| Thread list | Seed database, verify display |
| Thread detail | Navigate to thread, verify emails show |
| Send reply | Send via GreenMail, verify in IMAP |
| Sync | Click sync, verify new emails appear |

**Seed script needed:**
- Create test team, user (with known password)
- Create mailbox with GreenMail credentials
- Manual: Send email to test mailbox via GreenMail

---

## Dependencies Between Tasks

```
5.1 (shadcn) ─────────────┐
                          ├──> 5.4 (layout) ──> 5.5 (thread list) ──> 5.6 (detail) ──> 5.7 (composer)
5.3 (prisma) ──> 5.2 (auth)┘                                                              │
                                                                                           v
5.8 (API routes) <────────────────────────────────────────────────────────────────────────┘
                                                                                           │
5.9 (sync) <──────────────────────────────────────────────────────────────────────────────┘
```

---

## What Success Looks Like

After Phase 5:
1. Can log in with email/password (+ 2FA if enabled)
2. See sidebar with mailboxes
3. Click mailbox, see thread list
4. Click thread, see email chain
5. Compose and send reply
6. Click sync, see new emails appear

**Ready for Phase 6:** Comments, assignments, seen status (collaboration features)
