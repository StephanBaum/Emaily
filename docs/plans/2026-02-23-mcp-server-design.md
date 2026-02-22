# Emaily MCP Server Design

**Date:** 2026-02-23
**Status:** Approved
**Branch:** v2

## Overview

A standalone MCP (Model Context Protocol) server that enables AI agents — Claude Desktop, custom agents, and any MCP-compatible client — to interface with Emaily programmatically. Agents get full autonomy: read, search, triage, draft, send, collaborate, and trigger AI processing through typed MCP tools.

## Architecture

```
Claude Desktop / MCP-compatible Agent
       |
   MCP Protocol (stdio transport)
       |
   packages/mcp-server (Node.js process)
       |
   HTTP + Bearer API Key
       |
   apps/web Next.js API Routes (existing 56 routes)
       |
   PostgreSQL + Redis
```

**Key decision:** Thin MCP shell over existing REST API. The MCP server contains no business logic — it maps MCP tool calls to HTTP requests against the existing Next.js API. This ensures:

- Zero logic duplication between web UI and agent access
- All existing validation, auth, side effects (activity logs, notifications, cache invalidation) are reused
- New web features automatically become available to agents
- The web app must be running for the MCP server to function

## Package Structure

```
packages/mcp-server/
├── package.json              # @emaily/mcp-server
├── tsconfig.json
├── src/
│   ├── index.ts              # MCP server init + stdio transport
│   ├── client.ts             # HTTP client with API key auth
│   ├── config.ts             # Load API key + base URL from env/config
│   ├── tools/
│   │   ├── index.ts          # Tool registry
│   │   ├── threads.ts        # list_threads, get_thread, update_thread_status, search_threads
│   │   ├── email.ts          # send_email, get_email
│   │   ├── tags.ts           # list_tags, add_tag, remove_tag
│   │   ├── drafts.ts         # list_drafts, create_draft, update_draft, get_draft
│   │   ├── contacts.ts       # list_contacts, update_contact_trust
│   │   ├── assignments.ts    # create_assignment, update_assignment, list_assignments
│   │   ├── comments.ts       # add_comment, list_comments
│   │   ├── ai.ts             # trigger_ai_processing, get_ai_summary, list_agents
│   │   ├── mailboxes.ts      # list_mailboxes, get_mailbox_status
│   │   ├── notifications.ts  # list_notifications, mark_read
│   │   └── sync.ts           # trigger_sync
│   └── resources/
│       └── index.ts          # MCP resources (optional)
```

**Dependencies:** `@modelcontextprotocol/sdk`, `@emaily/shared` (types only). No Prisma, no database dependency.

## API Key Authentication

### Database Model

New `ApiKey` model in Prisma schema:

```prisma
model ApiKey {
  id         String    @id @default(cuid())
  name       String                          // "Claude Desktop", "My Script"
  keyHash    String    @unique               // SHA-256 hash (raw key never stored)
  keyPrefix  String                          // "emaily_sk_7f3a" (display identifier)
  userId     String
  user       User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  teamId     String
  team       Team      @relation(fields: [teamId], references: [id], onDelete: Cascade)
  scopes     String[]                        // ["threads:read", "threads:write", ...]
  lastUsedAt DateTime?
  expiresAt  DateTime?
  createdAt  DateTime  @default(now())

  @@index([keyHash])
  @@map("api_keys")
}
```

### Auth Flow

1. User generates key in Settings UI -> raw key shown once, SHA-256 hash stored in DB
2. MCP server sends `Authorization: Bearer emaily_sk_...` header with each request
3. Web app middleware: if Bearer token starts with `emaily_sk_`, look up `ApiKey` by SHA-256 hash
4. If valid and not expired, create a synthetic session with the key's userId/teamId
5. Check scopes against the requested operation
6. Existing route handlers work unchanged — they see a normal session

### Scopes

| Scope | Allows |
|-------|--------|
| `threads:read` | list_threads, get_thread, search_threads |
| `threads:write` | update_thread_status, batch_update_status, delete_thread |
| `email:read` | get_email |
| `email:send` | send_email |
| `tags:read` | list_tags |
| `tags:write` | add_tag_to_thread, remove_tag_from_thread |
| `drafts:read` | list_drafts, get_draft |
| `drafts:write` | create_draft, update_draft |
| `comments:read` | list_comments |
| `comments:write` | add_comment |
| `assignments:read` | list_assignments |
| `assignments:write` | create_assignment, update_assignment |
| `contacts:read` | list_contacts |
| `contacts:write` | update_contact_trust |
| `ai:read` | get_ai_summary, list_agents |
| `ai:write` | trigger_ai_processing |
| `mailboxes:read` | list_mailboxes |
| `sync:trigger` | trigger_sync |
| `notifications:read` | list_notifications |
| `notifications:write` | mark_notification_read |

## MCP Tool Catalog (~25 tools)

### Thread Management

| Tool | Description | API Route | Parameters |
|------|-------------|-----------|------------|
| `list_threads` | List threads with filtering | `GET /api/threads` | `status`, `mailboxId`, `tagId`, `search`, `limit`, `cursor` |
| `get_thread` | Full thread with emails | `GET /api/threads/[id]` | `threadId` |
| `search_threads` | Full-text + semantic search | `GET /api/threads?search=` | `query`, `mailboxId`, `status` |
| `update_thread_status` | Archive, snooze, trash, reopen | `PATCH /api/threads/[id]/status` | `threadId`, `status` |
| `batch_update_status` | Bulk status change | `POST /api/threads/batch/status` | `threadIds[]`, `status` |
| `delete_thread` | Move to trash | `DELETE /api/threads/[id]/delete` | `threadId` |

### Email Operations

| Tool | Description | API Route | Parameters |
|------|-------------|-----------|------------|
| `get_email` | Read single email content | New route needed | `emailId` |
| `send_email` | Send an email | `POST /api/emails/send` | `mailboxId`, `to`, `subject`, `body`, `inReplyTo?` |

### Tag Management

| Tool | Description | API Route | Parameters |
|------|-------------|-----------|------------|
| `list_tags` | Get all tags | `GET /api/tags` | -- |
| `add_tag_to_thread` | Tag a thread | `POST /api/threads/[id]/tags` | `threadId`, `tagId` |
| `remove_tag_from_thread` | Untag a thread | `DELETE /api/threads/[id]/tags` | `threadId`, `tagId` |

### Drafts & Collaboration

| Tool | Description | API Route | Parameters |
|------|-------------|-----------|------------|
| `list_drafts` | List shared drafts | `GET /api/shared-drafts` | `status?` |
| `create_draft` | Create shared draft | `POST /api/shared-drafts` | `threadId`, `mailboxId`, `subject`, `body` |
| `update_draft` | Edit a draft | `PATCH /api/shared-drafts/[id]` | `draftId`, `body`, `status?` |
| `add_comment` | Comment on thread | `POST /api/threads/[id]/comments` | `threadId`, `content` |
| `list_comments` | Get thread comments | `GET /api/threads/[id]/comments` | `threadId` |
| `create_assignment` | Assign thread to user | `POST /api/threads/[id]/assignments` | `threadId`, `assignedToId` |

### AI & Intelligence

| Tool | Description | API Route | Parameters |
|------|-------------|-----------|------------|
| `trigger_ai_processing` | Process thread with AI | `POST /api/ai/process` | `threadId` |
| `get_ai_summary` | Inbox activity summary | `GET /api/ai/summary` | `hours?` |
| `list_agents` | Available AI agents | `GET /api/agents` | -- |

### Contacts & Mailboxes

| Tool | Description | API Route | Parameters |
|------|-------------|-----------|------------|
| `list_contacts` | Contacts with trust levels | New route needed | `trustLevel?`, `search?` |
| `update_contact_trust` | Change sender trust | `POST /api/contacts/[id]/trust` | `contactId`, `trustLevel` |
| `list_mailboxes` | Connected mailboxes | `GET /api/mailboxes` | -- |
| `trigger_sync` | Sync mailboxes | `POST /api/sync` | -- |

### Notifications

| Tool | Description | API Route | Parameters |
|------|-------------|-----------|------------|
| `list_notifications` | Get notifications | `GET /api/notifications` | `unreadOnly?` |
| `mark_notification_read` | Mark as read | `PATCH /api/notifications/[id]` | `notificationId` |

## Configuration

### Claude Desktop Integration

```json
{
  "mcpServers": {
    "emaily": {
      "command": "node",
      "args": ["/path/to/Emaily/packages/mcp-server/dist/index.js"],
      "env": {
        "EMAILY_API_KEY": "emaily_sk_...",
        "EMAILY_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

### Config Resolution Order

1. Environment variables: `EMAILY_API_KEY`, `EMAILY_BASE_URL`
2. Config file: `~/.emaily-mcp.json`
3. Defaults: base URL = `http://localhost:3000`

## Error Handling

HTTP errors mapped to MCP error responses:

| HTTP Status | MCP Error | Message |
|-------------|-----------|---------|
| 401 | InvalidRequest | "Invalid API key. Generate one in Settings > API Keys." |
| 403 | InvalidRequest | "Insufficient scope: requires `threads:write`" |
| 404 | InvalidRequest | "Thread not found" |
| 429 | InvalidRequest | "Rate limited, retry after X seconds" |
| 500 | InternalError | "Server error (request ID: ...)" |

## Web UI Changes

New Settings section: **API Keys**

- Generate new key (name, scope selection, optional expiry date)
- List existing keys (prefix, name, last used timestamp, created date)
- Revoke/delete keys
- Copy Claude Desktop config snippet (pre-filled JSON with the key)

## New API Routes Needed

1. `GET /api/emails/[id]` — Fetch single email by ID (currently emails are only returned as part of thread)
2. `GET /api/contacts` — List contacts with filtering (currently only trust-related endpoints exist)
3. `POST /api/auth/api-keys` — CRUD for API key management
4. `GET /api/auth/api-keys` — List user's API keys
5. `DELETE /api/auth/api-keys/[id]` — Revoke an API key

## Value Proposition

1. **Autonomous email triage** — Agents read inbox, tag, prioritize, archive, and draft replies
2. **Cross-tool workflows** — "Check email for invoices, extract amounts, add to spreadsheet"
3. **Scheduled processing** — Morning briefing agent processes overnight email
4. **Multi-agent collaboration** — Different agents handle support vs. sales emails
5. **Email-driven automation** — "When meeting request arrives, check calendar and draft reply"
6. **Research assistance** — "Find all emails from X about project Y, summarize timeline"
7. **Team coordination** — Agent assigns threads based on expertise, adds context comments

## Future Extensions

- **SSE transport** for remote/cloud agent access
- **MCP Resources** to expose inbox state as subscribable resources
- **Webhooks/notifications** to push events to agents (new email, status change)
- **Prompt templates** as MCP prompts for common workflows (triage, briefing, search)
