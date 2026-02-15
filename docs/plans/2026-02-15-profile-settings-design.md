# Profile, Settings & Team Management Design

**Date:** 2026-02-15
**Branch:** v2
**Status:** Approved

## Overview

Full settings hub with user profile management, security controls, mailbox configuration, app preferences, team management, notifications, and self-registration with domain-based team auto-detection.

## Approach

Incremental Settings Hub (Approach 1): Build the settings layout shell first, then populate sections. Sign-up flow as a parallel piece. Existing agents settings page moves into the new layout.

---

## 1. Schema Changes

### User Model Additions

```prisma
model User {
  // ...existing fields...
  avatar       Bytes?    // PNG/JPEG stored as blob, max ~200KB
  avatarMime   String?   // "image/png" or "image/jpeg"
  preferences  Json      @default("{}")
}
```

**Preferences JSON structure:**

```json
{
  "theme": "system",
  "density": "comfortable",
  "dateFormat": "relative",
  "previewLines": 2,
  "notifications": {
    "browser": true,
    "sound": false,
    "digestEmail": false
  }
}
```

- `theme`: `"light"` | `"dark"` | `"system"`
- `density`: `"compact"` | `"comfortable"`
- `dateFormat`: `"relative"` | `"absolute"` | `"iso"`
- `previewLines`: `1` - `4`

### Mailbox Model Addition

```prisma
model Mailbox {
  // ...existing fields...
  signature  String?   // HTML signature for outgoing emails
}
```

Per-mailbox signature allows different signatures for each connected account.

### TeamInvite Model (New)

```prisma
model TeamInvite {
  id          String    @id @default(cuid())
  teamId      String
  email       String
  role        String    @default("member")
  invitedById String
  token       String    @unique
  expiresAt   DateTime
  acceptedAt  DateTime?
  createdAt   DateTime  @default(now())

  team      Team @relation(fields: [teamId], references: [id])
  invitedBy User @relation(fields: [invitedById], references: [id])

  @@index([email])
  @@index([token])
}
```

### Notification Model (New)

```prisma
model Notification {
  id         String   @id @default(cuid())
  userId     String
  teamId     String
  type       String   // "ai_notify" | "assignment" | "mention" | "invite"
  title      String
  message    String?
  targetType String?  // "thread" | "team_invite"
  targetId   String?
  read       Boolean  @default(false)
  createdAt  DateTime @default(now())

  user User @relation(fields: [userId], references: [id])
  team Team @relation(fields: [teamId], references: [id])

  @@index([userId, read])
  @@index([userId, createdAt])
}
```

### Tag Model Addition

```prisma
model Tag {
  // ...existing fields...
  notifyRoles  String[]  @default([])  // empty = all members, or ["admin"] etc.
}
```

---

## 2. Settings Layout

### Route Structure

```
(dashboard)/settings/
  layout.tsx            ← Sidebar nav + content area
  page.tsx              ← Redirects to /settings/profile
  profile/page.tsx
  security/page.tsx
  mailboxes/page.tsx
  preferences/page.tsx
  team/page.tsx
  agents/page.tsx       ← Existing page, moved here
```

### Sidebar Navigation

| Section | Icon | Route | Access |
|---------|------|-------|--------|
| Profile | User | /settings/profile | All |
| Security | Shield | /settings/security | All |
| Mailboxes | Mail | /settings/mailboxes | All |
| Preferences | Sliders | /settings/preferences | All |
| Team | Users | /settings/team | All (admin-only controls) |
| AI Agents | Bot | /settings/agents | All |

Sidebar uses vertical navigation with active state highlighting. Same visual language as the main app sidebar but narrower.

---

## 3. Profile Page

### Content

- **Avatar section**: Circular preview (current avatar or initials fallback). Upload button triggers file input. Client-side resize to max 200x200px before upload. Remove button to clear. Stored as `Bytes` in DB with `avatarMime`.
- **Name field**: Editable text input with save button.
- **Email display**: Read-only (changing email is security-sensitive, out of scope).
- **Account info**: Role badge, team name, member-since date.

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| PATCH | `/api/user/profile` | Update name |
| PUT | `/api/user/avatar` | Upload avatar (base64 body) |
| DELETE | `/api/user/avatar` | Remove avatar |
| GET | `/api/user/avatar/[userId]` | Serve avatar image (public, cacheable) |

---

## 4. Security Page

### Password Change

- Current password field (verification required)
- New password field with strength indicator (reuses `validatePasswordStrength()`)
- Confirm password field
- **Endpoint**: `POST /api/user/password`

### TOTP (2FA)

- **If disabled**: "Enable 2FA" button → generates secret via `generateTotpSecret()`, displays QR code via `generateTotpUri()`, asks for verification code to confirm setup.
- **If enabled**: Shows "2FA is active" status, "Disable 2FA" button requires current password.

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/user/totp/setup` | Generate secret, return QR URI |
| POST | `/api/user/totp/enable` | Verify code, activate TOTP |
| DELETE | `/api/user/totp` | Disable TOTP (requires password) |

---

## 5. Mailboxes Page

### List View

Cards for each connected mailbox showing:
- Email address, display name
- Type badge (personal/shared)
- Connection status indicator
- Last sync time
- "Add Mailbox" button

### Add/Edit Form

- Email address, display name, type (personal/shared)
- IMAP config: host, port, username, password
- SMTP config: host, port, username, password
- "Test Connection" button — validates IMAP/SMTP before saving
- Folder mappings: auto-detected from IMAP with manual override
- Signature editor: textarea for HTML signature

### Access Management (Shared Mailboxes, Admin Only)

- List team members with permission level (read/write/admin)
- Add/remove access controls

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/mailboxes` | Create mailbox |
| PATCH | `/api/mailboxes/[id]` | Update mailbox |
| DELETE | `/api/mailboxes/[id]` | Remove mailbox |
| POST | `/api/mailboxes/test-connection` | Test IMAP/SMTP credentials |
| GET | `/api/mailboxes/[id]/access` | List access entries |
| POST | `/api/mailboxes/[id]/access` | Grant access |
| PATCH | `/api/mailboxes/[id]/access/[accessId]` | Change permission |
| DELETE | `/api/mailboxes/[id]/access/[accessId]` | Revoke access |

---

## 6. Preferences Page

### Appearance

- **Theme toggle**: light / dark / system (uses CSS class toggling or `next-themes`)
- **Display density**: compact / comfortable (CSS variables for spacing/font sizes)

### Display

- **Date format**: relative / absolute / ISO
- **Email preview lines**: 1-4 (select)

### Notifications

- **Browser notifications**: toggle (requests permission on enable via Web Push API)
- **Sound on new email**: toggle (client-side audio)
- **Daily digest email**: toggle (future scope, stored in preferences)

All preferences saved to `User.preferences` JSON field. Applied via a React context provider that reads preferences on session load.

### API Endpoint

| Method | Route | Purpose |
|--------|-------|---------|
| PATCH | `/api/user/preferences` | Update preferences JSON |

---

## 7. Team Page

### All Members See

- Team name
- Member list: name, email, role badge, joined date, avatar

### Admin Controls

- Edit team name
- Invite member: email input + role selector → creates `TeamInvite` record with secure token
- Change member role (admin/member)
- Remove member (with confirmation)
- Pending invites list with revoke option

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| PATCH | `/api/team` | Update team name (admin) |
| GET | `/api/team/invites` | List pending invites (admin) |
| POST | `/api/team/invites` | Send invite (admin) |
| DELETE | `/api/team/invites/[id]` | Revoke invite (admin) |
| PATCH | `/api/team/members/[id]` | Change role (admin) |
| DELETE | `/api/team/members/[id]` | Remove member (admin) |

---

## 8. Sign-Up Flow

### Route

`(auth)/register/page.tsx`

### Registration Flow

1. User enters: name, email, password (with strength indicator)
2. On submit, extract domain from email (e.g., `brussobaum.de` from `user@brussobaum.de`)
3. Check if a team exists for that domain
4. **If team found**: "We found team **Brussobaum** — would you like to join?" → creates user, sends join request to team admin (pending until approved)
5. **If no team**: "Create a new team?" → user becomes admin of new team named after domain
6. After account creation, redirect to `/settings/mailboxes` to set up first mailbox

### Auto-Access on Join

When a new user joins an existing team (domain match + admin approval), they get `read` access to all shared mailboxes for that team. Admin can upgrade to `write` or `admin`.

### API Endpoint

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/auth/register` | Create account, handle team matching |

---

## 9. Notification System

### Purpose

Wire team members into AI actions, assignments, and team events. Fills the gap where the "notify" tag action was a placeholder.

### UI

- **Bell icon** in app header (next to user menu in sidebar) with unread count badge
- **Dropdown panel**: recent notifications, mark-as-read, click to navigate to target
- Each notification links to its target (thread detail page, team settings, etc.)

### Notification Triggers

| Trigger | Type | Recipients | Target |
|---------|------|-----------|--------|
| AI tag with `aiAction: "notify"` | `ai_notify` | Team members with mailbox access (filtered by `tag.notifyRoles`) | Thread |
| User assigned to thread | `assignment` | Assignee | Thread |
| Team invite accepted | `invite` | Inviting admin | Team settings |

### API Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/notifications` | List user notifications (paginated) |
| PATCH | `/api/notifications/[id]` | Mark as read |
| POST | `/api/notifications/mark-all-read` | Bulk mark read |

### Preferences Integration

- `notifications.browser`: enables Web Push API browser notifications
- `notifications.sound`: plays audio on new notification
- `notifications.digestEmail`: future scope

---

## 10. Existing Integration Points

All existing collaborative features work via `teamId` foreign key on User:

| Feature | How New Members Integrate |
|---------|--------------------------|
| **Assignments** | Automatically appear in `/api/team-members` dropdown |
| **Comments** | Can comment immediately, author tracked by `userId` |
| **Seen-By** | Automatically tracked on thread view |
| **Shared Drafts** | Can create/edit drafts, versions tracked by `userId` |
| **Activity Log** | Actions logged with `userId` attribution |
| **AI Context** | Names included in thread context for AI decisions |
| **Notify Action** | Receives notifications via new Notification model |
| **Shared Mailboxes** | Gets `read` access on team join, admin can upgrade |

---

## File Impact Summary

### New Files

- `apps/web/app/(auth)/register/page.tsx` + form component
- `apps/web/app/(dashboard)/settings/layout.tsx`
- `apps/web/app/(dashboard)/settings/page.tsx`
- `apps/web/app/(dashboard)/settings/profile/page.tsx`
- `apps/web/app/(dashboard)/settings/security/page.tsx`
- `apps/web/app/(dashboard)/settings/mailboxes/page.tsx`
- `apps/web/app/(dashboard)/settings/preferences/page.tsx`
- `apps/web/app/(dashboard)/settings/team/page.tsx`
- ~15 API route files for new endpoints
- ~10 component files for settings forms
- Notification bell component
- Preferences context provider
- Theme provider

### Modified Files

- `packages/database/prisma/schema.prisma` — new models + field additions
- `packages/shared/src/types/index.ts` — new type definitions
- `apps/web/app/(dashboard)/settings/agents/page.tsx` — adapt to new layout
- `apps/web/app/(dashboard)/layout.tsx` — add preferences provider
- `apps/web/components/inbox/sidebar.tsx` — add notification bell, settings link
- `apps/web/lib/ai.ts` — wire notify action to create Notification records
- `apps/web/app/api/threads/[id]/assignments/route.ts` — create notification on assign
