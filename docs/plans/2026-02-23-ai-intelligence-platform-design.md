# AI Email Intelligence Platform — Design Document

**Date**: 2026-02-23
**Status**: Approved
**Branch**: v2

## Overview

Transform Emaily from an AI-assisted email client into a full AI Email Intelligence Platform. Three pillars that build on each other:

1. **AI Email Memory & Smart Commitment Calendar** — persistent AI memory across all emails, proactive nudges, iCal feed
2. **Agent Enhancement** — playbooks, inter-agent collaboration, learning from corrections, action approval queue
3. **Smart Routing & Team Context** — auto-assignment, thread context panel, handoff protocol, SLA monitoring

Design principle: **Autopilot with guardrails** — AI handles routine patterns autonomously but escalates anything ambiguous to a human. Agents learn and improve from every correction.

---

## Pillar 1: AI Email Memory & Smart Commitment Calendar

### Problem

Important commitments, deadlines, and requests are buried in email threads. Things fall through the cracks — unsent proposals, unanswered client questions, stale conversations with open items. No one has a clear view of what's pending.

### Solution

The AI continuously extracts commitments from every email thread and maintains a live calendar exposed as a standard iCal feed.

### Commitment Types

| Type | Direction | Example |
|------|-----------|---------|
| Outbound promise | You → them | "I'll send the proposal by Friday" |
| Inbound promise | Them → you | "We'll have the contract ready Monday" |
| Open request | Them → you | Unanswered question or unresolved ask |
| Mentioned date | Either | Meeting, event, or deadline referenced in thread |
| Stale thread | Either | Conversation went quiet with unresolved items |

### Data Model

```
Commitment
  id            String   @id @default(cuid())
  teamId        String
  userId        String        // owner (who this commitment is relevant to)
  threadId      String        // source thread
  emailId       String?       // specific email where commitment was found
  contactId     String?       // the other party
  type          CommitmentType // outbound_promise | inbound_promise | open_request | mentioned_date | stale_thread
  direction     Direction     // inbound | outbound
  title         String        // user-friendly: "Send pricing proposal to John @ Acme"
  description   String        // context: quote from email, thread summary
  sourceQuote   String?       // exact text that triggered extraction
  dueDate       DateTime?     // explicit or AI-inferred
  dueDateInferred Boolean @default(false) // true if AI guessed the date
  status        CommitmentStatus // pending | fulfilled | overdue | dismissed | snoozed
  snoozeUntil   DateTime?
  fulfilledAt   DateTime?
  fulfilledByEmailId String?  // email that resolved this commitment
  confidence    Float         // AI confidence in the extraction
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
```

### Processing Pipeline

Commitment extraction runs as a new step in the existing `UnifiedThreadProcessor` pipeline:

1. Thread is processed (existing: tagging, intents, drafts)
2. **New**: Commitment extraction step analyzes the thread
3. AI identifies promises, requests, dates, stale items
4. Each commitment gets a clear, user-friendly title and description
5. AI infers due dates when not explicit ("by end of week" → Friday, "soon" → 3 business days)
6. Commitments are upserted (deduplicated by thread + source quote)
7. AI auto-marks commitments as "fulfilled" when it detects a resolving follow-up email

### Calendar Feed (iCal/ICS)

- Endpoint: `GET /api/calendar/:userId/feed.ics` (authenticated via unique token)
- Also: `GET /api/calendar/team/:teamId/feed.ics` (team-wide view)
- Standard iCal format — subscribe from Google Calendar, Outlook, Apple Calendar
- Each event includes:
  - **Summary**: Clear title ("Send pricing proposal to John @ Acme")
  - **Description**: Context quote, link back to thread in Emaily
  - **DTSTART/DTEND**: Due date (all-day event if no specific time)
  - **VALARM**: Configurable reminder (default: 1 day before)
  - **STATUS**: Maps commitment status to iCal status
  - **URL**: Deep link to the thread in Emaily
- Feed auto-updates as commitments change — calendar clients refresh on their schedule (typically every few hours)

### Nudge Feed (In-App)

- Dedicated section in inbox sidebar or dashboard
- Shows: approaching deadlines, overdue items, stale threads
- Each nudge: title, context, due date, link to thread, quick actions (dismiss, snooze, mark done)
- AI auto-dismisses nudges when it detects the commitment was fulfilled
- Manual snooze: "Remind me tomorrow / next week / in 3 days"

### API Endpoints

```
GET    /api/commitments          — list commitments (filterable by status, type, date range)
GET    /api/commitments/:id      — single commitment with thread context
PATCH  /api/commitments/:id      — update status (dismiss, snooze, mark fulfilled)
GET    /api/commitments/nudges   — upcoming/overdue commitments for nudge feed
GET    /api/calendar/:userId/feed.ics   — iCal feed (token-authenticated)
GET    /api/calendar/team/:teamId/feed.ics — team iCal feed
```

---

## Pillar 2: Agent Enhancement — Playbooks, Collaboration & Learning

### Existing Foundation

- `Agent` model: id, name, role, systemPrompt, temperature, active, isDefault
- `AgentTagWatch`: routes specific tags to specific agents
- Agent loop: multi-step reasoning with tools (assessThread, researchContext, proposeAction, requestHumanReview, escalate)
- `AiCorrection` model: tracks when users override AI decisions (exists but not fully activated)

### 2a. Agent Playbooks

Extend the `Agent` model with structured configuration fields:

```
Agent (extended)
  + allowedTools     String[]    // tool whitelist per agent
  + triggerConditions Json       // beyond tag watches: trust level, mailbox, thread age, commitment status
  + escalationRules  Json       // confidence thresholds, sender-based rules, topic-based routing
  + approvalMode     ApprovalMode // auto | review | suggest
  + maxAutoConfidence Float @default(0.9) // auto-approve threshold when mode is "auto"
```

**Approval modes**:
- `auto`: Trusted actions execute immediately (within confidence threshold)
- `review`: All actions queue for human approval
- `suggest`: Only show suggestions in the thread, never act

**Trigger conditions** (JSON schema):
```json
{
  "tags": ["support", "billing"],
  "trustLevels": ["vip", "trusted"],
  "mailboxIds": ["inbox-123"],
  "threadAge": { "olderThan": "24h" },
  "hasOpenCommitments": true
}
```

**Escalation rules** (JSON schema):
```json
{
  "rules": [
    { "condition": "confidence < 0.7", "action": "requestHumanReview" },
    { "condition": "senderTrust == 'vip'", "action": "requestHumanReview" },
    { "condition": "tags.includes('billing')", "action": "routeToAgent", "agentId": "finance-agent-id" }
  ]
}
```

**Settings UI**: Enhanced agent settings page to configure tools, triggers, escalation, and approval mode per agent.

### 2b. Agent Collaboration

Agents can consult each other during reasoning:

- New agent tool: `consultAgent(agentId, question)` — calls another agent's reasoning loop with a specific question
- Returns a structured response: answer text + confidence + supporting evidence
- **Guards**: Max consultation depth of 2 (no infinite recursion), no self-consultation, logged in AI activity
- **Use cases**:
  - Support Agent asks Knowledge Agent: "What did we tell this client about pricing last month?"
  - Triage Agent asks Sales Agent: "Is this a hot lead?"
  - Any agent asks Commitment Agent: "Are there open commitments with this sender?"

Implementation: The `consultAgent` tool creates a mini agent loop (single turn, no tool use) with the consulted agent's system prompt + the question + relevant thread context.

### 2c. Learning from Corrections

Activate and extend the existing `AiCorrection` model:

**Capture corrections**:
- User edits AI draft → store before/after diff, field changed
- User changes AI-applied tag → log the correction with reason
- User reassigns from AI assignment → record override
- User rejects action in queue → log rejection with optional reason

**Correction memory**:
- Per-agent correction log, queryable by sender, tag, topic
- Recent relevant corrections are injected into the agent's system prompt context:
  - "Note: Last time you drafted for sender@acme.com, the user changed the tone from formal to casual"
  - "Note: You previously tagged threads from this domain as 'support' but the user corrected to 'sales' (3 times)"
- Window: last 50 corrections per agent, weighted by recency

**Correction-based auto-approve evolution**:
- Track agent accuracy over time (actions approved vs rejected)
- Surface accuracy trends in dashboard: "Agent X: 72% → 89% over 30 days"
- Suggest promoting agents from `review` to `auto` mode when accuracy is high

### 2d. Action Queue with Approval Workflow

**Data model**:
```
AgentAction
  id            String @id @default(cuid())
  agentId       String
  threadId      String
  type          ActionType  // send_reply | apply_tag | assign | create_commitment | archive | escalate
  payload       Json        // action-specific data (draft content, tag id, assignee, etc.)
  confidence    Float
  reasoning     String      // agent's explanation of why it wants to do this
  status        ActionStatus // pending | approved | rejected | auto_approved | expired
  reviewedBy    String?     // userId who approved/rejected
  reviewedAt    DateTime?
  reviewNote    String?     // optional note from reviewer
  expiresAt     DateTime?   // auto-expire if unreviewed
  createdAt     DateTime @default(now())
```

**Review UI**:
- Notification badge: "5 agent actions pending review"
- List view: grouped by agent, showing action type, target thread, confidence, reasoning
- One-click: approve / reject / edit-then-approve
- Batch approve for trusted agents
- Inline preview: see the draft, the tag, the assignment before approving

**Auto-approve rules** (per agent):
- Based on `approvalMode` and `maxAutoConfidence`
- Additional rules configurable: "Always auto-approve tag actions", "Never auto-approve send actions"
- Escalation: If action unreviewed for X hours, notify designated reviewer

---

## Pillar 3: Smart Routing & Team Context

### 3a. AI-Powered Auto-Assignment

Enhance existing assignment system with intelligent routing:

- AI analyzes email content and matches to best team member based on:
  - Past interactions with the sender (who usually handles this contact?)
  - Expertise tags on users (configurable in user profile)
  - Current workload (open assigned thread count)
- Learns from manual reassignments as correction signals
- Configurable per mailbox: enable/disable, set fallback assignee
- Respects agent escalation rules (agent routing takes priority over general auto-assign)

**Data model additions**:
```
User (extended)
  + expertiseTags  String[]   // e.g., ["billing", "technical", "sales"]

AutoAssignmentConfig (per mailbox)
  + enabled        Boolean
  + fallbackUserId String?
  + balanceWorkload Boolean @default(true)
```

### 3b. Thread Context Panel

Sidebar shown when opening any thread:

- **AI summary**: "This thread is about X. Key decisions: Y. Open items: Z." (generated during AI processing, cached)
- **Related threads**: Same sender, same topic keywords, same tags (top 5, ranked by relevance)
- **Contact card**: Trust level, last 5 interactions, average response time, total thread count
- **Internal timeline**: Comments, assignments, handoffs, AI actions — chronological
- **Active commitments**: Open promises from the commitment calendar linked to this thread or contact

Pulls from existing data (threads, contacts, comments, assignments, activity log, commitments). No new models needed — this is a presentation layer.

### 3c. Handoff Protocol

When reassigning a thread:

1. AI auto-generates handoff summary from thread content + internal notes
2. Assigner can add context ("Client is frustrated about delivery delay")
3. System creates an `ActivityLog` entry with handoff details
4. Assignee receives notification with full context package: summary, internal notes, assigner's context, related threads
5. Ownership history preserved in activity log

**Data model additions**:
```
Assignment (extended)
  + handoffSummary  String?    // AI-generated context summary
  + handoffNote     String?    // assigner's manual context
```

### 3d. SLA Monitoring

- **SLA rules**: Define response targets per mailbox, tag, or trust level
  - Example: "VIP senders: first response within 2h", "Support inbox: resolve within 24h"
- **Tracking**: First-response time and resolution time per thread
- **Breach handling**: Auto-escalate on breach — reassign, notify manager, trigger agent action
- **Dashboard**: SLA health per team member, per mailbox, trends over time

**Data model**:
```
SlaRule
  id              String @id @default(cuid())
  teamId          String
  name            String
  targetType      SlaTargetType // mailbox | tag | trust_level
  targetValue     String        // mailbox id, tag id, or trust level
  metric          SlaMetric     // first_response | resolution
  thresholdMinutes Int
  breachAction    Json          // { notify: userId[], reassignTo: userId?, triggerAgent: agentId? }
  active          Boolean @default(true)
  createdAt       DateTime @default(now())

ThreadSlaStatus
  id              String @id @default(cuid())
  threadId        String @unique
  slaRuleId       String
  startedAt       DateTime      // when clock started (thread creation or last customer email)
  respondedAt     DateTime?     // first team response
  resolvedAt      DateTime?
  breached        Boolean @default(false)
  breachedAt      DateTime?
```

---

## Implementation Priority

Build order — each phase delivers value independently:

| Phase | Feature | Builds On |
|-------|---------|-----------|
| 1 | Commitment extraction + calendar feed | Existing AI pipeline |
| 2 | Nudge feed + commitment UI | Phase 1 |
| 3 | Agent playbooks (extended model + settings UI) | Existing agents |
| 4 | Action queue + approval workflow | Phase 3 |
| 5 | Agent collaboration (consultAgent tool) | Phase 3 |
| 6 | Learning from corrections | Existing AiCorrection model |
| 7 | Thread context panel | Existing data |
| 8 | Auto-assignment | Existing assignments |
| 9 | Handoff protocol | Phase 8 |
| 10 | SLA monitoring | Existing threads |

---

## Design Decisions

- **iCal over proprietary calendar**: Standard format means zero friction — users keep their existing calendar app
- **Enhance existing agents, don't rebuild**: Agent model, tag routing, and loop already work. We add configuration, collaboration, and learning on top.
- **Approval queue as the trust bridge**: Autopilot with guardrails means every agent action can be reviewed. Auto-approve rules are the path from "review everything" to "trust the agent."
- **Corrections as training data**: No fine-tuning needed — corrections are injected as few-shot examples in the agent's context window. Simple and immediate.
- **Nudge feed over email notifications**: Nudges live in the app where you're already working. No notification fatigue from yet another email.
