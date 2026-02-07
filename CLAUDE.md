# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Collaborative AI-powered email client replacing Gmail for self-hosted mail servers. Supports team collaboration (shared inboxes, assignments, comments) with local AI integration via Ollama.

## Commands

```bash
# Development
pnpm dev                    # Start all packages in dev mode (via turbo)
pnpm build                  # Build all packages
pnpm lint                   # Lint all packages
pnpm test                   # Run all tests
pnpm test:watch             # Watch mode for tests

# Single package commands (run from package directory)
cd apps/web && pnpm dev     # Start Next.js dev server only
cd apps/web && pnpm test    # Run web app tests only

# Docker (PostgreSQL + Redis + Ollama + GreenMail)
pnpm docker:up              # Start all services
pnpm docker:down            # Stop all services
pnpm docker:logs            # Follow container logs

# Database (from packages/database)
pnpm db:generate            # Generate Prisma client
pnpm db:push                # Push schema to database
pnpm db:migrate             # Run migrations
pnpm db:studio              # Open Prisma Studio
```

## Architecture

**Monorepo Structure (pnpm workspaces + turbo):**
- `apps/web` - Next.js 14 frontend (App Router, Tailwind, shadcn/ui-ready)
- `packages/shared` - TypeScript types shared across all packages
- `packages/database` - Prisma schema and database client
- `workers/` - Background workers for IMAP sync and AI processing (planned)

**Process Isolation Pattern:**
- Next.js handles UI/SSR and short API operations
- Long-running tasks (IMAP sync, AI drafting) run in isolated BullMQ workers
- Workers communicate via Redis queues, not inline API calls

**Key Infrastructure:**
- PostgreSQL with pgvector for semantic search
- Redis for job queues (BullMQ) and real-time (Socket.io)
- Ollama for local LLM inference pr n8n workflow requests via webhooks
- GreenMail for IMAP/SMTP testing

## Code quality
Refer to [Clean code Principles](docs/Principles/code.md) to keep the code clean and maintainable.


## Package Imports

Use path aliases defined in tsconfig:
```typescript
import { User, Thread } from "@emailautomation/shared";
import { prisma } from "@emailautomation/database";
import { something } from "@/components/...";  // within apps/web
```

## Domain Types

Core types in `packages/shared/src/types/index.ts`:
- `User`, `Team` - Auth and organization
- `Mailbox`, `MailboxAccess` - Email accounts (personal/shared)
- `Thread`, `Email` - Conversations (collaboration is thread-level, not email-level)
- `Tag`, `TagAIAction` - Auto-tagging with AI actions
- `EmailIntent`, `DraftConfidence` - AI processing
- `ActivityLog` - Audit trail

## Design Documents

Full architecture and implementation plans in `docs/plans/`:
- `2026-02-06-email-client-design.md` - Architecture, data model, security, AI pipeline
- `2026-02-06-email-client-implementation.md` - Phase-by-phase implementation plan

## Progress

Document your progress in `docs/progress.md`:

Note what features pf the plans you implemented.
in short technical notations / files that were touched / git commits related to the topic. etc to make it easier to track our progress.


