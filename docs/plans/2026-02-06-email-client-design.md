# Collaborative AI Email Client - Design Document

**Date:** 2026-02-06
**Status:** Approved
**Authors:** Design session collaboration

---

## Overview

A modern, collaborative email client that replaces Gmail as a client for self-hosted mail servers. Features AI-powered automation, team collaboration, and security-first architecture.

### Problem Statement

- Gmail ending POP3 support, breaking access to self-hosted mail servers
- Traditional clients (Outlook, Thunderbird) feel outdated, lack AI, not team-ready
- No affordable modern alternative with collaboration features

### Target Users

- Small team (2-5 people)
- Company domain with multiple email addresses
- Mix of personal inboxes and shared inboxes (info@, support@)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                 Web Client                       │
│         (React/Next.js, responsive)              │
└─────────────────────┬───────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────┐
│                 API Server                       │
│     (Next.js API routes - short ops only)        │
└───────┬─────────────┬─────────────┬─────────────┘
        │             │             │
┌───────▼───────┐ ┌───▼───┐ ┌───────▼───────┐
│  Mail Engine  │ │  DB   │ │  AI Gateway   │
│ (IMAP/SMTP)   │ │(Postgres)│ │(Ollama/n8n) │
└───────────────┘ └───────┘ └───────────────┘
```

### Process Isolation

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Next.js    │    │   Workers    │    │   Mail Sync  │
│   Web App    │    │  (BullMQ)    │    │   Service    │
│              │    │              │    │              │
│  - UI/SSR    │    │  - AI jobs   │    │  - IMAP only │
│  - API calls │    │  - Cleanup   │    │  - Isolated  │
│  - WebSocket │    │  - Exports   │    │  - Restarts  │
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Redis     │
                    │  (Queue +   │
                    │   PubSub)   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │ PostgreSQL  │
                    │ + pgvector  │
                    └─────────────┘
```

---

## Data Model

### Users & Teams

```
User
├── id, email, name, password_hash
├── totp_secret (2FA)
├── role (admin, member)
└── belongs_to: Team

Team
├── id, name
├── settings (AI config, mail server credentials)
└── has_many: Users, Mailboxes
```

### Mailboxes & Access

```
Mailbox
├── id, email_address (e.g., info@company.com)
├── type: "personal" | "shared"
├── imap/smtp credentials (encrypted)
└── belongs_to: Team

MailboxAccess
├── user_id, mailbox_id
├── permission: "read" | "write" | "admin"
└── (links users to shared mailboxes they can access)
```

### Threading & Emails

```
Thread
├── id, team_id, mailbox_id
├── subject (normalized, without Re:/Fwd:)
├── last_activity_at
├── status: "open" | "archived" | "snoozed"
└── has_many: Emails, Comments, Assignments, Tags

Email
├── id, thread_id, message_id
├── in_reply_to, references (raw headers for threading)
├── imap_uid (for sync, prevents duplicates)
├── subject, body_text, body_html
├── from, to, cc, bcc, date
├── raw_headers (JSON, full header storage)
├── folder, is_draft, is_sent
├── embedding: vector(384) (for semantic search)
└── has_many: Attachments
```

### Attachments

```
Attachment
├── id, email_id
├── filename, content_type, size
├── storage_path (encrypted file reference)
├── checksum (for deduplication)
```

### Collaboration

```
Comment
├── id, thread_id, user_id
├── content, created_at

Assignment
├── thread_id, assigned_to, assigned_by
├── status: "open" | "in_progress" | "done"
├── due_date (optional)

SeenBy
├── thread_id, user_id, last_seen_email_id, seen_at

ThreadTag
├── thread_id, tag_id
├── applied_by: "manual" | "auto" | "ai"
```

### Shared Drafts

```
SharedDraft
├── id, thread_id (nullable - could be new thread)
├── mailbox_id, created_by
├── to, cc, bcc, subject, body
├── status: "drafting" | "ready_for_review" | "sent"
├── locked_by (user_id, prevents conflicts)
├── lock_type: "editing" | "generating"
├── lock_expires_at
├── has_many: DraftVersions

DraftVersion (history)
├── id, shared_draft_id, user_id
├── body_snapshot, created_at
```

### Contacts

```
Contact
├── id, team_id
├── email, name, company
├── tags (JSON array)
├── notes, last_contacted_at
├── auto_learned: boolean
└── has_many: ContactEmails (link to threads)
```

### Audit & Activity

```
ActivityLog (append-only)
├── id, team_id, user_id
├── action: "assigned" | "tagged" | "replied" | "archived" | ...
├── target_type: "thread" | "email" | "contact" | ...
├── target_id
├── metadata (JSON, sanitized for PII)
├── created_at
├── ip_address
├── checksum (hash chain for tamper detection)
```

### Sync State

```
MailboxSync
├── mailbox_id, folder_name
├── last_uid, last_sync_at
├── sync_status: "idle" | "syncing" | "error"
├── error_message (if failed)
```

---

## AI System

### Processing Pipeline

```
New Email Arrives
       │
       ▼
┌──────────────────┐
│  0. Bot Filter   │ ── Check headers, reject auto-generated loops
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  1. Threading    │ ── Match to existing thread or create new
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  2. Contact      │ ── Match sender to Contact, or auto-create
│     Matching     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  3. Auto-Tagging │ ── Rules engine + ML classifier
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  4. Intent       │ ── Decompose into discrete questions/tasks
│     Extraction   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  5. AI Action    │ ── Confidence-based drafting
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  6. Routing      │ ── Auto-assign to team member (optional)
└──────────────────┘
```

### Bot Detection & Loop Prevention

```
BotDetection
├── Check headers:
│   ├── Auto-Submitted: auto-generated
│   ├── X-Auto-Response-Suppress
│   ├── Precedence: bulk/junk/list
│   └── From contains "noreply@", "mailer-daemon"
├── Check patterns:
│   ├── Out-of-office keywords in subject/body
│   └── Known bot signatures (configurable list)
└── Action: flag as "bot_generated", skip AI actions

LoopPrevention
├── Track: outbound message_id + recipient
├── If reply arrives within 60 seconds from same domain → flag
├── Max auto-replies per thread: 1 (hard limit)
└── Cooldown: no auto-reply to same address within 24h
```

### Auto-Tagging Engine

```
TagRule (explicit rules you define)
├── id, tag_id, priority
├── conditions (JSON):
│   ├── from_contains: "@supplier.com"
│   ├── subject_contains: "invoice"
│   ├── to_mailbox: "finance@yourcompany.com"
│   └── (combinable with AND/OR logic)
└── active: boolean

TagMLModel (learned patterns)
├── id, tag_id, team_id
├── model_type: "classifier"
├── training_data_count
├── accuracy_score
├── last_trained_at
└── model_path (serialized model file)
```

### Intent Extraction

```
EmailIntent
├── id, email_id
├── intents (JSON array):
│   [
│     { "type": "question", "text": "What's the delivery date?", "priority": 1 },
│     { "type": "request", "text": "Send updated invoice", "priority": 2 },
│     { "type": "info", "text": "New address provided", "priority": 3 }
│   ]
├── extracted_at
└── model_version

DraftRequirement (links intent to draft)
├── email_intent_id, shared_draft_id
├── intent_index
├── addressed: boolean
├── source: "rag" | "qa_pair" | "generated"
```

### Confidence-Based Actions

| Confidence | Tag Action | Draft Action | UX |
|------------|------------|--------------|-----|
| 90%+ | Auto-apply | Auto-draft, "Ready to Send" badge | One-click send |
| 70-89% | Auto-apply | Draft created, "Review Suggested" | Shows diff/highlights |
| 50-69% | Suggest (don't apply) | Draft created, "Low Confidence" | Manual review required |
| <50% | No action | No draft, show "Needs Human" | Inbox item flagged |

### Q&A Pairs

```
QAPair
├── id, team_id
├── trigger_patterns (JSON array of example questions)
├── ideal_response (template or example)
├── tags (which tags activate this)
├── usage_count, success_rate
├── auto_learned: boolean
└── approved: boolean (human-verified)
```

### Training Data Quality Filter

```
ReplyQualityScore
├── id, email_id (the sent reply)
├── original_draft_id (what AI suggested, if any)
├── quality_score: float (0-1)
├── quality_signals (JSON):
│   ├── length_adequate: boolean (>20 chars)
│   ├── professional_tone: float
│   ├── addresses_intents: float
│   ├── contains_substance: boolean
│   └── grammar_score: float
├── eligible_for_training: boolean
└── human_approved: boolean

Quality Thresholds:
├── Score < 0.5 → discard, never train on this
├── Score 0.5-0.8 → flag for human review
├── Score 0.8+ → auto-add to training queue
└── All Q&A pairs require human_approved = true before active
```

---

## Security Architecture

### Encryption Layers

```
Layer 1: Transport + Storage (always on)
├── TLS 1.3 in transit
├── AES-256 at rest (DB, files)
└── Server CAN read with Worker Key

Layer 2: Team Encryption (optional, configurable)
├── Extra E2E layer for highly sensitive teams
├── Disables server-side AI processing
└── Client-side only search/AI

Default Mode: Layer 1 only (AI works, still encrypted at rest)
Paranoid Mode: Layer 1 + 2 (no server AI, client-side only)
```

### AI Worker Security

```
Hardened Worker Process:
├── Runs in isolated container/VM
├── No internet egress (only LLM endpoint)
├── Memory encrypted, wiped after job
├── No persistent storage
└── Reads email → processes → flushes

Network Rules:
├── Inbound: only from API server
├── Outbound: only Ollama (localhost) or n8n
└── No external internet access
```

### Searchable Encryption (Blind Indexing)

```
SearchIndex (separate from emails)
├── id, email_id
├── token: sha256(lowercase(word) + team_salt)
├── position: int (word position, for phrase search)
└── No raw text stored
```

### Attachment Security

```
Attachment Ingestion Flow:

  Email Arrives (TLS decrypted)
           │
           ▼
  Extract Attachment
           │
           ▼
  Malware Scan (ClamAV) ◄── BEFORE encryption
           │
       ┌───┴───┐
       │       │
    Clean   Infected
       │       │
       ▼       ▼
   Encrypt   Quarantine
   + Store   + Alert
```

### JWT Security

```
RefreshToken
├── id, user_id, token_hash
├── family_id (groups related tokens)
├── used: boolean
├── created_at, expires_at

Theft Detection:
├── If used token presented again → THEFT DETECTED
├── Invalidate ALL tokens in that family_id
├── Force re-login
├── Alert user
```

### Audit Log Sanitization

```
SanitizationRules:
├── Strip patterns:
│   ├── Email addresses in free-text → "[EMAIL]"
│   ├── Phone numbers → "[PHONE]"
│   ├── Credit card patterns → "[CARD]"
│   └── Search queries → hash only
├── Allowed in metadata:
│   ├── IDs (email_id, user_id, thread_id)
│   ├── Action types
│   └── Counts
```

### Master Key Recovery

```
Shamir's Secret Sharing:
├── Master Key split into 5 shares
├── Any 3 shares can reconstruct
├── Fewer than 3 = mathematically impossible

Share Distribution:
├── Share 1: CEO (physical safe, office A)
├── Share 2: CTO (physical safe, office B)
├── Share 3: Secure bank deposit box
├── Share 4: Company lawyer (sealed envelope)
├── Share 5: Encrypted backup (requires 2FA from CEO + CTO)
```

---

## Tech Stack

### Frontend

```
Framework:    Next.js 14+ (App Router)
Language:     TypeScript (strict mode)
Styling:      Tailwind CSS + shadcn/ui components
State:        Zustand or TanStack Query
Real-time:    Socket.io client
Email Editor: TipTap (rich text)
Mobile:       Responsive CSS
```

### Backend

```
Runtime:      Node.js 20+
Framework:    Next.js API Routes (short ops only)
Database:     PostgreSQL 15+ with pgcrypto + pgvector
ORM:          Prisma
Auth:         NextAuth.js + custom 2FA
Real-time:    Socket.io server
Queue:        BullMQ + Redis
Mail:         nodemailer (SMTP) + isolated IMAP worker
```

### AI & Processing

```
Local LLM:    Ollama (llama3, mistral, etc.)
Orchestration: n8n (self-hosted)
Embeddings:   Ollama (nomic-embed-text) → pgvector
Malware Scan: ClamAV
```

### Infrastructure

```
Container:    Docker + Docker Compose (local dev)
Production:   Same server as mail
Reverse Proxy: Nginx or Caddy
Backups:      pg_dump + encrypted to S3
Monitoring:   PM2 / Prometheus + Grafana
```

---

## Project Structure

```
emailautomation/
├── apps/
│   └── web/                    # Next.js app
│       ├── app/                # App router pages
│       │   ├── (auth)/         # Login, 2FA
│       │   ├── (dashboard)/    # Main app
│       │   └── api/            # API routes
│       ├── components/         # React components
│       └── lib/                # Client utilities
│
├── packages/
│   ├── database/               # Prisma schema + migrations
│   ├── mail-engine/            # IMAP sync, SMTP send
│   ├── ai-engine/              # Tagging, drafting, intents
│   ├── security/               # Encryption, audit logging
│   └── shared/                 # Types, constants
│
├── workers/
│   ├── sync-worker/            # Background IMAP sync
│   ├── ai-worker/              # AI processing jobs
│   └── cleanup-worker/         # Maintenance tasks
│
├── docker/
│   ├── docker-compose.yml
│   ├── Dockerfile.web
│   └── Dockerfile.worker
│
└── docs/
    └── plans/
```

---

## Testing Strategy

### Testing Pyramid

```
                    ╱╲
                   ╱  ╲
                  ╱ E2E ╲         Few, slow, critical paths
                 ╱──────╲
                ╱        ╲
               ╱Integration╲      API, DB, mail sync
              ╱────────────╲
             ╱              ╲
            ╱     Unit       ╲    Fast, many, isolated
           ╱──────────────────╲
```

### Unit Tests
- Tool: Vitest
- Target: Pure functions, utilities, business logic
- Coverage: 80%+ on packages/*

### Integration Tests
- Tool: Vitest + testcontainers
- Target: API routes, DB operations, service layers
- Setup: Fresh Postgres per test file

### E2E Tests
- Tool: Playwright
- Target: Critical user flows
- Run: Nightly + before deploy

### Mail Sync Tests
- Tool: GreenMail (Docker) or custom mock
- Scenarios: Initial sync, incremental, reconnection, rate limits

### Security Tests
- Static: eslint-plugin-security, npm audit, semgrep
- Runtime: Auth bypass, permissions, injection, encryption verification

### AI Evaluation Suite
- Golden path emails with expected outputs
- LLM-as-a-Judge scoring (Accuracy, Tone, Intent Coverage)
- Build fails if score < 4.0

### Load Tests
- Tool: k6
- Scenarios: 50 concurrent users, thundering herd (500 emails at once)
- Metrics: API p95 < 200ms, queue recovery < 5 min

---

## UI/UX Summary

### Desktop Layout
- Three-column: Mailboxes | Thread List | Thread Detail
- Thread indicators: unread, AI draft ready, comments, assignments
- Intent checklist in thread detail
- Team comments section

### Mobile Layout
- Single column, tap to drill down
- Collapsible sections for drafts and comments
- Bottom action bar

### AI Draft Experience
- Confidence badge (green/yellow/red)
- Intent coverage checklist
- Highlighted AI-generated sections
- One-click send for high confidence

---

## Success Criteria

1. **Functional:** Can send/receive email via IMAP/SMTP
2. **Collaborative:** Team can assign, comment, see status
3. **Intelligent:** AI tags and drafts with >70% accuracy
4. **Secure:** Passes OWASP Top 10 review
5. **Performant:** API p95 < 200ms with 50 users
6. **Reliable:** Mail sync recovers from disconnections

---

## Open Questions (To Resolve During Implementation)

1. Exact Ollama model selection (llama3 vs mistral for drafting)
2. n8n workflow specifics for RAG endpoint
3. Shared draft conflict resolution UX details
4. Mobile notification strategy (PWA vs native wrapper)
