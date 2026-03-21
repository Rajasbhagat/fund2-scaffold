# Project Research Summary

**Project:** FUND II Trend Mapper
**Domain:** Multi-project pedagogical AI chat web application (single-workspace, no auth)
**Researched:** 2026-03-21
**Confidence:** MEDIUM-HIGH

---

## Executive Summary

The FUND II Trend Mapper is a focused internal tool: a single Next.js 14 App Router application where MBA students create named "projects" (one per trend being explored), and each project has a persistent AI chat backed by Vertex AI Gemini. There is no authentication — the entire cohort shares one URL. The defining technical challenge is not the chat UI itself (well-trodden territory) but three interconnected requirements: (1) keeping Vertex AI credentials server-side and out of the browser, (2) injecting pre-extracted megatrend documents as static system context on every request without a RAG pipeline, and (3) getting streaming responses to work correctly end-to-end through Next.js Route Handlers. These three pieces must be wired correctly before a single feature is usable.

The recommended approach is straightforward: one repo, one Node.js process, no external services beyond Vertex AI. The AI layer uses either the Vercel AI SDK with `@ai-sdk/google-vertex` (less boilerplate, Path A) or `@google-cloud/vertexai` directly (more control, Path B). The database is SQLite via Prisma 5 — zero infrastructure, sufficient for a single cohort of ~40 students. The megatrend docs (three `.docx`/`.pdf` files) must be extracted to plain text once at setup time and committed to the repo; they are loaded from disk at server startup and injected into every Vertex AI request as the `systemInstruction`. No vector database, no RAG, no file upload pipeline. The agent behavior (challenge-first, scaffold-don't-solve, pre-class vs. in-class modes) is entirely governed by the existing system prompt — no UI configuration is needed.

The dominant risk category is infrastructure misconfiguration, not feature complexity. Five pitfalls have near-certain probability of occurring if not addressed explicitly: using Edge runtime on AI routes (breaks gcloud auth), failing to add the Prisma singleton (causes SQLite lock errors during development), not extracting megatrend docs before first run (context injection silently produces garbage), not enabling SQLite WAL mode (concurrent reads block during streaming writes), and ADC credential path not resolving correctly in non-gcloud-CLI environments. All five are preventable with day-one setup steps and do not require architectural decisions later.

---

## Key Findings

### Recommended Stack

A lean, single-repo full-stack setup with no external infrastructure. Next.js 14 (App Router) handles both the UI and the backend API. Vertex AI Gemini 1.5 Pro is the LLM. SQLite via Prisma 5 is the database. Tailwind CSS and shadcn/ui handle the frontend. All LLM calls happen in Node.js Route Handlers — never Edge functions, never Server Actions.

**Core technologies:**

| Technology | Purpose | Why |
|------------|---------|-----|
| Next.js 14.2.x | Full-stack framework | App Router streaming, Route Handlers, single repo for UI + API |
| TypeScript 5.4.x | Type safety | Prisma generates typed client; catches schema/API mismatches at compile time |
| Node.js 20 LTS | Runtime | Required for `@google-cloud/vertexai` — Google Auth Library is Node-only, no edge support |
| `@ai-sdk/google-vertex` + `ai` (Path A) | LLM layer + streaming | `useChat` + `streamText` reduce streaming boilerplate by ~80%; try this first |
| `@google-cloud/vertexai` (Path B fallback) | LLM layer | Use if ADC auth fails in the AI SDK wrapper; requires manual ReadableStream bridging |
| Prisma 5.16.x + SQLite | Database + ORM | Type-safe queries, schema migrations, zero infrastructure; sufficient for one cohort |
| Tailwind CSS 3.4.x + shadcn/ui | Styling + components | Utility-first, zero runtime cost; copy-paste Radix primitives for chat UI components |
| Zod 3.23.x | Input validation | Validate all API inputs before touching DB or LLM — no auth means no trust of inputs |

**What NOT to use:**
- `@google/generative-ai` — wrong product (API key auth, not ADC/Vertex)
- Edge runtime (`export const runtime = 'edge'`) on AI routes — breaks gcloud auth
- Server Actions for chat streaming — cannot return `ReadableStream` in Next.js 14
- Vector database (Pinecone, pgvector) — corpus is too small to justify; Gemini 1.5 Pro's 1M token window makes RAG unnecessary

See `/STACK.md` for full installation commands and code patterns.

---

### Expected Features

The full MVP feature set is smaller than it might appear. Most items are low-complexity UI. The medium-complexity work is the streaming pipeline and the chat persistence layer. The highest-effort item is not engineering — it is testing that the system prompt guardrails hold (no full slide decks, no pain-point language, no invented statistics).

**Must have (MVP — Phase 1):**
- Project dashboard — create, list, rename, delete; sorted by recency
- Persistent chat per project — load history on open, survive page refresh
- Streaming AI response — Vertex AI Gemini with system prompt + megatrend context + web search grounding
- Markdown rendering — headers, bold, bullets in assistant responses
- Loading indicator + error states — thinking spinner; error toast with retry affordance
- Correct agent persona — the Trend Mapper system prompt must be injected faithfully on every request

**FUND II differentiators (what makes this different from generic ChatGPT):**
- Megatrend knowledge base pre-injected as system context (Impact Impulse Matrix, Great Fragmentation, Deep Research Report)
- Vertex AI Grounding for web search — agent spec mandates real citations; this is a config option, not custom code
- Strict system prompt fidelity — challenge-first, scaffold-don't-solve, pre-class vs. in-class awareness, Session 3 bridge language

**Defer to Phase 2:**
- PDF/slide export (copy-paste is sufficient for MVP)
- Dark mode
- Conversation search
- Auth + per-user isolation (only needed when cohort size or privacy requires it)

**Never build without explicit decision:**
- User login or accounts
- File upload from students
- Any agent other than Trend Mapper

**Anti-features to explicitly exclude:** real-time collaboration, chat branching, message editing, agent config UI, RAG pipeline, project archiving/tagging.

See `/FEATURES.md` for the full feature dependency chain and complexity breakdown.

---

### Architecture Approach

A single Next.js 14 application. No separate backend process. Route Handlers (`app/api/`) act as the API boundary — they run in the Node.js runtime and own all Vertex AI and Prisma calls. React Client Components handle chat UI state and streaming consumption. Server Components handle initial data loading (project list, chat history). SQLite stores only conversation turns — never the system prompt or megatrend docs (which are injected from disk at request time).

**Major components:**

| Component | Type | Responsibility |
|-----------|------|---------------|
| `app/page.tsx` | Server Component | Dashboard — renders project list via Prisma directly |
| `app/projects/[projectId]/page.tsx` | Server Component | Chat view — loads project + history from DB for initial render |
| `ChatWindow.tsx` | Client Component | Manages streaming state, message list, scroll-to-bottom |
| `ChatInput.tsx` | Client Component | Textarea + submit; disabled during active stream |
| `MessageBubble.tsx` | Client Component | Renders markdown in chat bubbles |
| `app/api/projects/route.ts` | Route Handler | CRUD: list + create projects |
| `app/api/projects/[id]/route.ts` | Route Handler | CRUD: get, rename, delete single project |
| `app/api/chat/[projectId]/route.ts` | Route Handler (Node.js) | Core: load history, persist user message, stream Vertex AI response, persist assistant message |
| `lib/prisma.ts` | Singleton module | One PrismaClient per process — prevents hot-reload connection exhaustion |
| `lib/vertexai.ts` | Module | VertexAI client, `streamChatResponse()`, rolling history window |
| `lib/context.ts` | Module | Load system prompt + megatrend text from disk once; cache in module scope |

**Data flow for a new chat message:**
```
User types → ChatInput → POST /api/chat/:projectId
→ Load history from SQLite
→ Persist user message to SQLite
→ Build Vertex AI request (history + systemInstruction with full context)
→ generateContentStream → ReadableStream
→ Stream tokens to browser while buffering full response
→ Stream closes → persist assistant message to SQLite
```

**Key schema decisions:**
- `role` field uses `"user"` and `"model"` (matching Vertex AI's `Content.role` values — no translation needed)
- `onDelete: Cascade` on Message — deleting a project removes all messages automatically
- No `userId` column — no auth in MVP
- Composite index `[projectId, createdAt]` — covers the only query pattern: all messages for project X, ordered by time

See `/ARCHITECTURE.md` for directory structure, full API route table, and code patterns.

---

### Critical Pitfalls

All six critical pitfalls below will occur without explicit prevention. None require architectural rethinking — they are all day-one setup decisions.

1. **Edge runtime silently breaks Vertex AI SDK** — Add `export const runtime = 'nodejs'` to every Route Handler that calls Vertex AI. The gcloud credential chain requires Node.js `fs` access; the Edge runtime blocks it. Build succeeds but requests return 403.

2. **Prisma client multiplied by hot-reload** — Use the global singleton pattern in `lib/prisma.ts` from day one. Without it, every file save in `next dev` creates a new PrismaClient, exhausting SQLite connections and producing `SQLITE_BUSY` errors that disappear on cold restart.

3. **Raw DOCX/PDF bytes sent as context** — DOCX files are ZIP-compressed XML; they cannot be read with `fs.readFileSync` and passed as text. Extract all megatrend docs to `.txt` files using `mammoth` (DOCX) and `pdf-parse` (PDF) in a one-time setup script. Commit the `.txt` files. Never run extraction at request time.

4. **Megatrend docs exceed practical token budget** — Extracted docs may reach 50,000–100,000 tokens. Measure with Vertex AI `countTokens` before committing the strategy. Budget a hard ceiling of 30,000 tokens for megatrend context. If exceeded, produce one-time condensed summaries (3,000–5,000 tokens each) rather than injecting full text. Always use the `systemInstruction` field, not the `contents` array.

5. **ADC credential not found outside gcloud CLI context** — `gcloud auth application-default login` writes to `~/.config/gcloud/`. When Next.js runs as a process manager process, Docker container, or CI job, `~` may resolve differently. Set `GOOGLE_APPLICATION_CREDENTIALS` explicitly in `.env.local` pointing to the absolute path. For production, use a service account JSON key — never ship gcloud user credentials.

6. **SQLite WAL mode not enabled — concurrent reads block writes** — Default SQLite journal mode causes reads to block during write transactions. With streaming (long-lived writes), the project list page will fail while a chat is active. Run `PRAGMA journal_mode=WAL` and `PRAGMA busy_timeout=5000` via `prisma.$executeRaw` immediately after client creation.

**Moderate pitfalls to address during implementation:**
- System prompt placed in `contents` array instead of `systemInstruction` — puts instructions in the conversation turn array, causes model to treat them as user messages
- Streaming response buffered by reverse proxy in production — add `X-Accel-Buffering: no` and `Cache-Control: no-cache` headers to the streaming route
- Unbounded chat history growth — implement a rolling window (`slice(-40)`) when building the Vertex AI history array; preserve first 2 turns + last 20
- `prisma generate` not in `postinstall` — add it immediately; schema changes without regeneration cause stale TypeScript types and runtime failures

See `/PITFALLS.md` for detection signatures and exact prevention code for all 16 pitfalls.

---

## Implications for Roadmap

All research converges on the same dependency chain: infrastructure before features. The megatrend context injection is a prerequisite for the AI behavior being correct. The AI behavior correctness is a prerequisite for pedagogical testing. Project CRUD is a prerequisite for the chat UI having anything to attach to. Nothing is parallelizable until the streaming pipeline is proven end-to-end.

### Phase 0: Environment and Document Extraction (Prerequisite — no UI)

**Rationale:** Three of the six critical pitfalls occur before a single line of application code is written. Getting these right first means every subsequent phase can be tested immediately without debugging environment issues. This is also the only phase with a hard dependency on external state (existing `.docx`/`.pdf` files and gcloud credentials). It has zero UI and zero database work.

**Delivers:**
- Next.js 14 project scaffolded with TypeScript, Tailwind, Prisma, and shadcn/ui installed
- Prisma singleton (`lib/prisma.ts`) in place with WAL mode initialization
- Megatrend docs extracted to `.txt` files and committed (`content/megatrends/`)
- `lib/context.ts` loading and caching the system prompt + extracted docs
- `.env.local` with `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS`
- Token count measured — megatrend context confirmed within 30,000-token budget
- Vertex AI connectivity smoke-tested (one raw API call, no UI)

**Addresses from FEATURES.md:** Megatrend knowledge base injection (differentiator), agent persona fidelity
**Avoids from PITFALLS.md:** Pitfalls 3 (raw DOCX bytes), 4 (token budget), 5 (ADC credential path), 6 (WAL mode), 14 (DOCX garbage)
**Research flag:** Standard patterns — no deeper research needed. All steps are deterministic and well-documented.

---

### Phase 1: Data Layer and Project CRUD

**Rationale:** Before any chat UI exists, the database schema and CRUD API must be stable. These are the load-bearing beams the rest of the application rests on. Getting the schema right (especially `role` field values matching Vertex AI's `"user"`/`"model"` convention) avoids a painful migration mid-feature-build. Project CRUD is entirely low-complexity UI and can be done quickly once the schema is locked.

**Delivers:**
- `prisma/schema.prisma` with `Project` and `Message` models, composite index, cascade delete
- `prisma migrate dev` run, `prisma generate` in `postinstall`
- Route Handlers: `GET/POST /api/projects`, `GET/PATCH/DELETE /api/projects/[id]`
- Zod validation on all API inputs
- Dashboard page (`app/page.tsx`) — project list, create button
- Project create/rename modal, delete confirmation dialog
- Navigation from dashboard to project page

**Addresses from FEATURES.md:** Project dashboard, create/rename/delete, project list sorted by recency
**Avoids from PITFALLS.md:** Pitfalls 9 (migration path), 11 (stale Prisma types), 13 (GET route caching — add `force-dynamic`)
**Research flag:** Standard patterns — Prisma + Next.js CRUD is fully documented. No deeper research needed.

---

### Phase 2: Streaming Chat Pipeline (Core — the hard phase)

**Rationale:** This is the highest-risk phase and the one where all three research files intersect. The streaming pipeline touches Vertex AI credentials, the ReadableStream bridging pattern, system context injection, chat history reconstruction, message persistence timing, and the client-side `useChat` hook. It must be built in the right order: prove streaming works with a minimal prompt first, then add megatrend context, then wire up persistence, then add history window.

**Delivers:**
- `app/api/chat/[projectId]/route.ts` with `export const runtime = 'nodejs'`
- Vertex AI streaming: either Path A (`streamText` + `@ai-sdk/google-vertex`) or Path B (`generateContentStream` + manual ReadableStream bridge)
- System prompt + megatrend context injected via `systemInstruction` (not `contents`)
- Chat history loaded from DB, formatted as `[{ role, parts }]` array, rolling window of 40 messages
- User message persisted to DB before streaming starts; assistant message persisted in `onFinish` (Path A) or after stream closes (Path B)
- `ChatWindow.tsx` — streaming consumption with `useChat` hook or manual `reader.read()` loop
- `ChatInput.tsx` — disabled during active stream
- `app/projects/[projectId]/page.tsx` — initial history loaded via Server Component
- Streaming response headers: `X-Accel-Buffering: no`, `Cache-Control: no-cache`

**Addresses from FEATURES.md:** Persistent chat history, streaming AI response, agent persona fidelity, web search grounding config
**Avoids from PITFALLS.md:** Pitfalls 1 (Edge runtime), 2 (AsyncIterator bridging), 8 (unbounded history), 10 (system prompt in wrong field)
**Research flag:** Needs careful implementation sequencing. Recommend building a minimal streaming smoke test (hardcoded "hello" prompt, no DB, no context) first. Validate streaming works end-to-end before adding megatrend context or history. The Vercel AI SDK Path A vs. Path B decision should be made here — try Path A first; switch to Path B only if ADC fails in the bridge layer.

---

### Phase 3: Chat UI Polish and Pedagogical Verification

**Rationale:** Once streaming works, the remaining UI work is low-complexity but requires careful testing against the pedagogical spec. Markdown rendering, loading states, and error handling are individually simple but together determine whether the app feels finished. The system prompt fidelity testing (guardrail verification) is the highest-effort item in this phase — it requires running real conversations through the agent and checking for spec violations.

**Delivers:**
- `MessageBubble.tsx` with `react-markdown` rendering (headers, bold, bullets, code blocks)
- Loading indicator ("thinking" state) while stream is in progress
- Error state — toast or inline error with retry affordance
- Responsive layout — sidebar (project list) + main panel (chat); collapses on small screens
- Guardrail testing: verify agent never produces a full slide deck, never uses "pain point" language, never invents statistics, correctly signals Session 3 bridge language
- Vertex AI Grounding enabled and verified (real citations appearing in responses)

**Addresses from FEATURES.md:** Markdown rendering, loading/error states, responsive layout, strict system prompt fidelity, challenge-first opening, web search grounding
**Avoids from PITFALLS.md:** Pitfall 7 (proxy buffering — verify in actual deployment config), Pitfall 15 (MIME type sniffing — add `X-Content-Type-Options: nosniff`)
**Research flag:** The guardrail testing has no engineering pattern — it requires domain knowledge of the FUND II pedagogy spec. Flag for manual QA with the course faculty or a test student. The Vertex AI Grounding configuration may need verification against current API docs (MEDIUM confidence in research).

---

### Phase Ordering Rationale

- Phase 0 before everything: environment misconfiguration is the single most likely source of lost time. Proving Vertex AI connectivity and document extraction before any feature work eliminates false debugging.
- Phase 1 before Phase 2: the chat Route Handler needs a stable `projectId` to load history and persist messages. Schema migrations mid-streaming-build cause friction.
- Phase 2 before Phase 3: streaming must be functional before UI polish is meaningful. A broken stream cannot be polished.
- All pitfall mitigations from PITFALLS.md are front-loaded into Phase 0 and Phase 1 — they are setup-time decisions that cannot be cleanly retrofitted.

### Research Flags

**Phases needing verification during implementation:**
- **Phase 2 (Streaming):** `@ai-sdk/google-vertex` version stability — was in active development as of August 2025; confirm latest stable version and that `useChat` API is unchanged between AI SDK v3 and v4. If auth fails in the bridge, fall back to Path B immediately.
- **Phase 2 (Streaming):** Vertex AI Grounding exact API config — research has MEDIUM confidence on the specific parameter name and structure; verify against current Google Cloud docs during implementation.
- **Phase 3 (QA):** Practical per-request token quota for your GCP project/region — varies by tier; check GCP console under Vertex AI quotas before running load tests.

**Phases with standard patterns (no deeper research needed):**
- **Phase 0:** Document extraction with `mammoth` and `pdf-parse` — established npm libraries with stable APIs.
- **Phase 1:** Prisma CRUD + Next.js Route Handlers — fully documented, HIGH confidence.
- **Phase 3:** `react-markdown` rendering — standard, no research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM-HIGH | Core choices (Next.js 14, Prisma, SQLite, Tailwind) are HIGH confidence. `@ai-sdk/google-vertex` is MEDIUM — version was in active development; verify before install. Confirm `ai` SDK v3 vs v4 distinction. |
| Features | HIGH | Agent spec is fully defined and authoritative. Feature set derived from spec + well-established AI chat product patterns. No ambiguity on MVP scope. |
| Architecture | HIGH | Next.js App Router streaming patterns verified against official docs (March 2026). Prisma singleton pattern is official. ADC credential chain is stable, well-documented behavior. |
| Pitfalls | MEDIUM-HIGH | Critical pitfalls 1, 3, 5, 6 are HIGH confidence (verified against official sources). Pitfall 4 (token budget) is MEDIUM — actual doc token counts must be measured. Pitfall 7 (proxy buffering) depends on deployment environment. |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address During Implementation

1. **Actual token count of extracted megatrend docs** — Research estimates 50,000–100,000 tokens for the three docs. This must be measured with `countTokens` before the system context strategy is finalized. If it exceeds 30,000 tokens, one-time condensed summaries are needed. This is a Phase 0 deliverable.

2. **`@ai-sdk/google-vertex` current version and API stability** — Run `npm show @ai-sdk/google-vertex version` before installing. If the package has jumped to a major version since August 2025, review the changelog. If Path A auth fails in the development environment, switch to Path B (direct SDK) without hesitation.

3. **Vertex AI Grounding configuration parameter** — Research notes MEDIUM confidence on the exact API structure for enabling grounding. Verify against current `@google-cloud/vertexai` SDK docs during Phase 2.

4. **GCP project quota for Vertex AI** — Per-request input token quotas vary by region and billing tier. Check the GCP console under `Vertex AI > Quotas` before running multi-user tests. If the default quota is below 100K tokens/minute, request an increase before the student cohort uses the tool.

5. **System prompt fidelity cannot be verified by engineering** — The agent guardrails (challenge-first behavior, no slide deck generation, Session 3 bridge language) require pedagogical review. Plan a manual QA session with the course faculty after Phase 3 streaming is complete. Engineering cannot sign off on this — it requires someone who knows the FUND II curriculum.

---

## Sources

### Primary (HIGH confidence)
- Next.js 14/15 Route Handlers official docs (verified March 2026) — streaming patterns, `runtime = 'nodejs'`, `params` async behavior
- Prisma documentation — SQLite provider, singleton pattern, `postinstall` hook, migration commands
- Google Cloud ADC documentation (via `google-auth-library`) — credential resolution order, service account setup
- FUND II Trend Mapper System Prompt (`/Trend Mapper/FUND_II_Trend_Mapper_System_Prompt.txt`) — agent behavior spec, guardrails, operating modes
- PROJECT.md (`/.planning/PROJECT.md`) — validated requirements and constraints

### Secondary (MEDIUM confidence)
- `@google-cloud/vertexai` Node.js SDK (training data, August 2025) — `startChat()`, `sendMessageStream()`, `systemInstruction` field, streaming async iterator
- Vercel AI SDK v3 documentation — `useChat`, `streamText`, `toAIStreamResponse`, `onFinish` callback
- `@ai-sdk/google-vertex` — wraps Vertex AI for AI SDK; verify current version before use
- Vertex AI Grounding API — specific config parameter for web search; verify against current docs
- ChatGPT Projects / Claude Projects / Perplexity Spaces — feature pattern benchmarks for AI chat product conventions

### Tertiary (LOW confidence — verify before using)
- Vertex AI per-request token quotas — varies by project/region/tier; check GCP console
- Gemini 1.5 Pro context window practical limits — 1M tokens on paper; real-world quality degrades at high context; monitor in production

---
*Research completed: 2026-03-21*
*Ready for roadmap: yes*
