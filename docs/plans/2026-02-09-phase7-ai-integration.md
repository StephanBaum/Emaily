# Phase 7: AI Integration

## Context

Emaily needs AI-powered email processing: auto-tagging, intent extraction, and draft generation. All database models (`EmailIntent`, `Tag.autoRules`, `QAPair`, `SharedDraft.confidence`, etc.) already exist in the Prisma schema. The shared types (`EmailIntent`, `DraftConfidence`, `TagAIAction`) are defined. What's missing is the AI engine, provider implementations, processing pipeline, and the wiring.

**Provider strategy:** Abstraction layer supporting Gemini 2.5 Flash (cloud, for testing/production) and Ollama (local, self-hosted). Auto-detected from environment variables.

**Processing strategy:** BullMQ background worker from day one. Sync route enqueues jobs; a separate worker process handles AI calls asynchronously.

---

## Branch

```
git checkout v2 && git checkout -b feature/ai-integration
```

---

## Sub-Phase 7.1: AI Engine Package + Provider Abstraction

Create `packages/ai-engine/` as a workspace package.

### Files to create

**`packages/ai-engine/package.json`**
- Name: `@emailautomation/ai-engine`
- Dependencies: `@google/generative-ai` (Gemini SDK), `@emailautomation/shared`, `@emailautomation/database`
- Ollama uses plain `fetch` - no SDK needed

**`packages/ai-engine/tsconfig.json`** - Copy pattern from `packages/mail-engine/tsconfig.json`

**`packages/ai-engine/src/providers/provider.ts`** - Core interface:
```typescript
interface AIProvider {
  name: string;
  complete(request: CompletionRequest): Promise<CompletionResponse>;
  embed(text: string): Promise<number[]>;
  isAvailable(): Promise<boolean>;
}
```
- `CompletionRequest`: messages (role/content), temperature, maxTokens, responseFormat (text/json)
- `CompletionResponse`: content, usage stats, model name, finishReason

**`packages/ai-engine/src/providers/gemini-provider.ts`**
- Uses `@google/generative-ai` SDK
- Model: `gemini-2.5-flash` for completions
- Model: `text-embedding-004` for embeddings
- Maps ChatMessage[] to Gemini's content format

**`packages/ai-engine/src/providers/ollama-provider.ts`**
- Uses `fetch` against Ollama REST API (`/api/chat`, `/api/embed`)
- Default model: `llama3.2`, embedding: `nomic-embed-text`
- Default host: `http://localhost:11434`

**`packages/ai-engine/src/config.ts`** - Provider factory:
- `createProviderFromEnv()`: reads `AI_PROVIDER`, `GEMINI_API_KEY`, `OLLAMA_HOST`, etc.
- Auto-detects: if `GEMINI_API_KEY` is set, use Gemini; otherwise Ollama

**`packages/ai-engine/src/index.ts`** - Package exports

### Files to modify

- **`packages/shared/src/types/index.ts`** - Add `TagRuleCondition`, `TagAutoRules`, `AIProcessingResult` types

---

## Sub-Phase 7.2: Auto-Tagging Pipeline

Two-layer system: deterministic rules first, then LLM classification for unmatched tags.

### Files to create

**`packages/ai-engine/src/prompts/auto-tag.ts`**
- Builds system + user prompt for tag classification
- Input: email subject/body/sender + available tag names
- Output format: JSON array of `{ name, confidence }`

**`packages/ai-engine/src/pipeline/auto-tagger.ts`** - `AutoTagger` class:
1. `evaluateRules(email, tags)` - Match `Tag.autoRules` conditions (field/operator/value with AND/OR logic). Returns matches with confidence 1.0, appliedBy "auto"
2. `classifyWithLLM(email, unmatchedTags)` - Call provider for remaining tags. Returns matches with confidence score, appliedBy "ai"
3. `tagEmail(email, tags)` - Runs both layers, rules first

### Files to modify

- **`apps/web/app/api/tags/[id]/route.ts`** - Add `autoRules` to PATCH handler body destructuring

---

## Sub-Phase 7.3: Intent Extraction Pipeline

Decompose emails into discrete questions, requests, and informational items.

### Files to create

**`packages/ai-engine/src/prompts/intent-extraction.ts`**
- System prompt: extract intents as question/request/info with priority 1-3
- Includes thread context (previous emails summarized) for context-aware extraction
- Output: JSON `{ intents: [{ type, text, priority }] }`

**`packages/ai-engine/src/pipeline/intent-extractor.ts`** - `IntentExtractor` class:
- `extractIntents(email)` - Calls provider, parses + validates response
- `buildThreadContext(previousEmails)` - Summarizes prior emails (~1000 chars)
- `validateIntents(raw)` - Sanitizes LLM output, enforces schema, limits to 10

---

## Sub-Phase 7.4: Draft Generation Pipeline

Confidence-based draft generation triggered by tag AI actions.

### Files to create

**`packages/ai-engine/src/prompts/draft-generation.ts`**
- System prompt: generate professional email reply addressing extracted intents
- Includes: original email, intents to address, Q&A pairs for reference, thread context
- Output: JSON `{ subject, body, confidence: { overall, intentCoverage, qaMatchStrength, ragRelevance, toneConsistency } }`

**`packages/ai-engine/src/pipeline/draft-generator.ts`** - `DraftGenerator` class:
- `generateDraft(email, intents, qaPairs, threadContext)` - Full draft with confidence scoring
- `matchQAPairs(intents, qaPairs)` - Find relevant Q&A pairs for the extracted intents
- `calculateConfidence(response)` - Parse and validate confidence scores

---

## Sub-Phase 7.5: BullMQ Worker + Integration

Wire everything together with async background processing.

### Files to create

**`apps/web/lib/ai-queue.ts`** - Queue client for the web app:
- `enqueueEmailForAI(emailId, teamId)` - Add job to queue
- Uses `ioredis` + `bullmq` Queue

**`apps/web/lib/ai.ts`** - AI service layer (used by both API routes and worker):
- `processEmailWithAI(emailId, teamId)` - Full pipeline: fetch email + tags, run auto-tagger, run intent extractor, check tag AI actions, generate draft if triggered, store results
- Provider singleton via `createProviderFromEnv()`

**`workers/ai-worker/package.json`**
- Dependencies: `bullmq`, `ioredis`, `tsx`, `@emailautomation/ai-engine`, `@emailautomation/database`, `@emailautomation/shared`

**`workers/ai-worker/src/index.ts`** - Entry point, starts worker, handles SIGTERM

**`workers/ai-worker/src/processor.ts`** - BullMQ Worker:
- Processes `process_email` jobs: calls `processEmailWithAI`
- Concurrency: 3, rate limit: 10/minute (for API quotas)
- 3 retries with exponential backoff

**`workers/ai-worker/src/queues.ts`** - Queue + job type definitions

### API endpoints to create

**`apps/web/app/api/ai/process/route.ts`** - POST: manually trigger processing
- Body: `{ emailId?, threadId? }` - process specific email, all in thread, or batch for team

**`apps/web/app/api/ai/status/route.ts`** - GET: provider health check
- Returns: `{ provider, status, model }`

**`apps/web/app/api/threads/[id]/intents/route.ts`** - GET: fetch intents for thread

### Files to modify

- **`apps/web/app/api/sync/route.ts`** - After email creation in `addEmailToThread` and `createThread` callbacks, call `enqueueEmailForAI(emailId, teamId)`
- **`apps/web/package.json`** - Add deps: `@emailautomation/ai-engine`, `bullmq`, `ioredis`
- **`turbo.json`** - Add `workers/ai-worker` dev task if needed

### Environment variables (apps/web/.env.local)

```
# Already present
GEMINI_API_KEY=...

# Add
REDIS_URL=redis://localhost:6379
# AI_PROVIDER=gemini  (auto-detected from GEMINI_API_KEY)
# GEMINI_MODEL=gemini-2.5-flash
```

---

## Sub-Phase 7.6: Minimal UI Integration

### Files to create

**`apps/web/components/thread/intent-panel.tsx`**
- Displays extracted intents in the collaboration panel
- Grouped by email, color-coded by type (question/request/info)
- Priority badges

### Files to modify

- **`apps/web/app/(dashboard)/thread/[id]/page.tsx`** - Fetch intents, render IntentPanel in collaboration panel
- **`apps/web/components/inbox/thread-item.tsx`** - Small "AI" indicator on tags where `appliedBy === "ai"`

---

## Implementation Order

```
7.1 AI Engine Package (provider abstraction)
 |
 +--> 7.2 Auto-Tagging (rules + LLM)
 |
 +--> 7.3 Intent Extraction
 |
 +--> 7.4 Draft Generation
 |
 \--> 7.5 BullMQ Worker + API + Sync integration
       |
       \--> 7.6 UI (intent panel, AI tag badges)
```

7.2, 7.3, 7.4 can be built sequentially within the ai-engine package. 7.5 wires everything up. 7.6 is last.

---

## Key Reference Files

| File | Why |
|------|-----|
| `packages/mail-engine/package.json` | Pattern for new package structure |
| `packages/shared/src/types/index.ts` | Existing AI types to extend |
| `packages/database/prisma/schema.prisma` | All AI models already defined |
| `apps/web/app/api/sync/route.ts` | Integration point for AI processing |
| `apps/web/app/api/threads/[id]/tags/route.ts` | Pattern for tag application with appliedBy |
| `apps/web/app/api/shared-drafts/route.ts` | Pattern for draft creation with confidence |
| `apps/web/components/thread/collaboration-panel.tsx` | Where intent panel plugs in |

---

## Verification

1. **7.1**: `pnpm test` in ai-engine passes; both providers implement interface correctly
2. **7.2**: Rules engine matches test emails; LLM classification returns valid tags (mocked provider)
3. **7.3**: Intent extraction returns structured intents from seed emails
4. **7.4**: Draft generation produces reply with confidence scores for tagged emails
5. **7.5**: Worker starts, processes queued jobs; `POST /api/ai/process` triggers processing; `GET /api/ai/status` returns provider info; sync route enqueues jobs
6. **7.6**: Thread detail shows intents; AI-applied tags show indicator
7. **End-to-end**: Run sync on seeded mailbox -> emails get auto-tagged + intents extracted -> drafts generated for action-tagged threads -> visible in UI
