# Roadmap: FUND II Trend Mapper

## Overview

This roadmap delivers MVP v1.0 of the FUND II Trend Mapper — a multi-project web application giving IESE MBA students a persistent AI thinking partner for trend exploration. The journey follows a strict dependency chain: the infrastructure and document extraction must be correct before any feature is testable; the data layer must be stable before the chat pipeline has anything to attach to; the streaming pipeline must be functional before UI polish is meaningful. Four phases, no parallelism, no shortcuts — the architecture demands this order.

## Milestone: MVP v1.0

**Goal:** A working, deployed web app where students can create trend exploration projects, open a persistent Trend Mapper chat in each project, receive streaming AI responses grounded in real web data and the FUND II megatrend knowledge base, and pick up exactly where they left off across browser sessions.

**Done when:** All 4 phases complete, agent guardrails manually verified against the FUND II spec, and the app is accessible at its deployment URL.

---

## Phases

- [x] **Phase 1: Foundation & Environment** - Scaffold the Next.js project, extract megatrend docs to plain text, wire Vertex AI ADC, and confirm the system context loads and the LLM responds *(completed 2026-03-21)*
- [ ] **Phase 2: Project Management** - Build the dashboard and all project CRUD so students can create, rename, delete, and open named projects *(4/5 stories complete — in progress)*
- [ ] **Phase 3: Streaming Chat Pipeline** - Wire the core AI pipeline: Route Handler, streaming Vertex AI responses, full context injection, chat history persistence, and rolling window
- [ ] **Phase 4: UI Polish & Agent Verification** - Markdown rendering, loading/error states, responsive layout, and manual QA of all pedagogical guardrails

---

## Phase Details

### Phase 1: Foundation & Environment
**Goal**: The project builds and runs, Vertex AI responds to a raw test call, megatrend docs are extracted to clean text and within token budget, and the database is initialized with WAL mode enabled
**Depends on**: Nothing (first phase)
**Requirements**: ENV-01, ENV-02, ENV-03, ENV-04
**Success Criteria** (what must be TRUE):
  1. `next dev` starts without errors and the app loads in the browser
  2. A raw Vertex AI test call (no UI, no DB) returns a valid response using ADC credentials
  3. All three megatrend documents exist as `.txt` files in `content/megatrends/` and their combined token count is measured and confirmed within the 30,000-token budget
  4. `lib/context.ts` loads the system prompt and all three megatrend texts from disk without errors on server startup
  5. SQLite database is initialized with WAL mode; `lib/prisma.ts` uses the singleton pattern and no `SQLITE_BUSY` errors appear during `next dev` hot-reloads

**Plans**: 3 plans

Plans:
- [ ] 01-01: Scaffold Next.js 14 project with TypeScript, Tailwind CSS, shadcn/ui, Prisma 5 + SQLite, and all required dependencies (`@ai-sdk/google-vertex`, `ai`, `zod`); configure `.env.local` with `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, `GOOGLE_APPLICATION_CREDENTIALS`; add `prisma generate` to `postinstall`
- [ ] 01-02: Write extraction script using `mammoth` (DOCX) and `pdf-parse` (PDF) to convert all three megatrend source files to `.txt`; commit extracted files to `content/megatrends/`; measure combined token count with `countTokens`; produce condensed summaries if over 30,000 tokens; implement `lib/context.ts` to load and cache system prompt + docs at server startup
- [ ] 01-03: Define Prisma schema (`Project`, `Message` models with composite index and cascade delete); run `prisma migrate dev`; implement `lib/prisma.ts` singleton with WAL mode and busy timeout; write a one-file smoke test script that calls Vertex AI with the cached system context and prints the response to verify end-to-end connectivity

---

### Phase 2: Project Management
**Goal**: Students can manage all their trend projects from a dashboard — create, rename, delete, and navigate into each project's dedicated workspace
**Depends on**: Phase 1
**Requirements**: PROJ-01, PROJ-02, PROJ-03, PROJ-04, PROJ-05
**Success Criteria** (what must be TRUE):
  1. Student opens the app and sees a dashboard listing all existing projects, sorted by most recently updated
  2. Student can create a new project by entering a name — it appears on the dashboard immediately without a full page reload
  3. Student can rename a project inline or via a modal — the new name persists after page refresh
  4. Student can delete a project with a confirmation step — the project and all its messages are removed from the database
  5. Student can click a project and navigate to its dedicated chat page (chat UI may be a placeholder at this stage)

**Plans**: 3 plans

Plans:
- [ ] 02-01: Implement Route Handlers for project CRUD — `GET /api/projects` (list, sorted by `updatedAt` desc), `POST /api/projects` (create, Zod-validated name), `GET /api/projects/[id]` (single project), `PATCH /api/projects/[id]` (rename), `DELETE /api/projects/[id]` (delete + cascade); add `force-dynamic` to prevent GET route caching
- [ ] 02-02: Build the dashboard page (`app/page.tsx` as Server Component rendering initial project list); implement project card component with "Open", "Rename", and "Delete" affordances; add create-project button with name input; wire all interactions to the Route Handlers using client-side fetches with optimistic UI updates
- [ ] 02-03: Build project routing — `app/projects/[projectId]/page.tsx` as Server Component; add navigation from dashboard to project page; handle not-found case (deleted project ID in URL); add breadcrumb or back-nav to return to dashboard

---

### Phase 3: Streaming Chat Pipeline
**Goal**: Students can send messages in a project's chat and receive real-time streaming responses from Gemini, grounded with the FUND II system prompt, all three megatrend documents, and Vertex AI web search; conversation history persists across browser sessions
**Depends on**: Phase 2
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, AGENT-01, AGENT-02, AGENT-03, AGENT-04, AGENT-05
**Success Criteria** (what must be TRUE):
  1. Student sends a message and sees the agent's response stream in word-by-word in the chat window — no full-page reload, no waiting for the complete response before text appears
  2. The agent's first response to a new project demonstrates challenge-first behavior consistent with the FUND II system prompt (not a generic ChatGPT-style "How can I help you?" opener)
  3. Closing the browser tab and reopening the project shows the full prior conversation intact
  4. The agent cites real web sources when making factual claims about trends (Vertex AI Grounding active)
  5. Chat input is disabled and visually indicates "thinking" while a stream is active — no double-sends possible

**Plans**: 4 plans

Plans:
- [ ] 03-01: Implement the core Route Handler `app/api/chat/[projectId]/route.ts` with `export const runtime = 'nodejs'`; start with Path A (`streamText` + `@ai-sdk/google-vertex`); if ADC auth fails in the SDK bridge, fall back to Path B (`generateContentStream` + manual `ReadableStream`); add streaming response headers (`X-Accel-Buffering: no`, `Cache-Control: no-cache`)
- [ ] 03-02: Wire full context injection into every request — system prompt from `lib/context.ts` into `systemInstruction` (not `contents` array), all three megatrend texts appended to system instruction; configure Vertex AI Grounding (web search) as a tool/config on the model call; verify against current SDK docs for exact grounding parameter structure
- [ ] 03-03: Implement chat history persistence — load all messages for the project from SQLite on each request, apply rolling window (preserve first 2 turns + last 20 for a max of 40 turns), format as `[{ role: "user"|"model", parts }]` array; persist user message to DB before streaming starts; persist complete assistant message after stream closes (in `onFinish` for Path A, post-stream for Path B)
- [ ] 03-04: Build client-side chat components — `ChatWindow.tsx` (Client Component, manages streaming state via `useChat` hook or manual `reader.read()` loop, scroll-to-bottom on new tokens); `ChatInput.tsx` (textarea + submit button, disabled during active stream); update `app/projects/[projectId]/page.tsx` to load initial chat history via Server Component and hydrate `ChatWindow`

---

### Phase 4: UI Polish & Agent Verification
**Goal**: The app feels complete and trustworthy — responses render with proper formatting, error states are handled gracefully, the layout works across screen sizes, and the agent's pedagogical behavior has been manually verified against the full FUND II spec
**Depends on**: Phase 3
**Requirements**: CHAT-07, CHAT-08, CHAT-09
**Success Criteria** (what must be TRUE):
  1. Agent responses render with correct markdown formatting — headers are visually distinct, bold text is bold, bullet lists are indented, code blocks use monospace — not raw asterisks and pound signs
  2. A "thinking" indicator (spinner or animated dots) appears immediately when a message is sent and disappears when the first token arrives
  3. When a Vertex AI call fails, the chat shows an inline error message with a retry affordance — the app does not crash or silently hang
  4. The layout is usable on a laptop screen (primary use case) and does not break on a tablet; project list and chat panel coexist without overflow
  5. Manual QA against the FUND II spec confirms: agent never outputs a complete 6-slide deck, never uses "pain point" language, never invents statistics without a citation, and correctly signals the Session 3 bridge to the Value Designer

**Plans**: 3 plans

Plans:
- [ ] 04-01: Implement `MessageBubble.tsx` with `react-markdown` and appropriate plugins (`remark-gfm` for tables and strikethrough); apply Tailwind prose classes for readable typography; differentiate user and assistant bubble styles visually
- [ ] 04-02: Add loading state — "thinking" spinner/animation rendered in `ChatWindow` while `isLoading` is true; implement error state — catch Vertex AI errors in the Route Handler and return structured error JSON; display inline error with retry button in `ChatWindow`; add `X-Content-Type-Options: nosniff` header to streaming route
- [ ] 04-03: Implement responsive layout — sidebar showing project list (collapsible on small screens) + main chat panel; ensure no horizontal overflow on common viewport sizes; run manual pedagogical QA session covering Pre-Class mode (6-slide scaffolding workflow), In-Class mode (S-curve, 2x2 grid), all four guardrails, and terminology discipline ("problems" not "pain points")

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4

| Phase | Stories Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation & Environment | 5/5 | ✅ Complete | 2026-03-21 |
| 2. Project Management | 4/5 | 🔄 In Progress | - |
| 3. Streaming Chat Pipeline | 0/6 | ○ Pending | - |
| 4. UI Polish & Agent Verification | 0/6 | ○ Pending | - |

---

## Requirement Coverage

**v1 requirements: 23 total | Mapped: 23 | Unmapped: 0**

| Requirement | Description | Phase |
|-------------|-------------|-------|
| ENV-01 | Megatrend docs extracted to plain text | Phase 1 |
| ENV-02 | Token count verified within Gemini budget | Phase 1 |
| ENV-03 | Vertex AI ADC credentials wired and verified | Phase 1 |
| ENV-04 | SQLite WAL mode + Prisma singleton | Phase 1 |
| PROJ-01 | User can create a new project with a name | Phase 2 |
| PROJ-02 | User can view all projects on a dashboard | Phase 2 |
| PROJ-03 | User can rename a project | Phase 2 |
| PROJ-04 | User can delete a project (with confirmation) | Phase 2 |
| PROJ-05 | User can open a project and enter its chat view | Phase 2 |
| CHAT-01 | Each project has its own isolated chat thread | Phase 3 |
| CHAT-02 | Chat streams responses from Vertex AI Gemini | Phase 3 |
| CHAT-03 | Chat history persists per project across sessions | Phase 3 |
| CHAT-04 | Full system prompt injected on every request | Phase 3 |
| CHAT-05 | All three megatrend docs injected as context | Phase 3 |
| CHAT-06 | Rolling window applied to avoid token limit | Phase 3 |
| AGENT-01 | Agent operates in Pre-Class mode | Phase 3 |
| AGENT-02 | Agent operates in In-Class mode | Phase 3 |
| AGENT-03 | Agent uses Vertex AI Grounding (web search) | Phase 3 |
| AGENT-04 | All guardrails enforced | Phase 3 |
| AGENT-05 | Terminology discipline enforced | Phase 3 |
| CHAT-07 | Agent responses render markdown | Phase 4 |
| CHAT-08 | Loading state shown while agent responds | Phase 4 |
| CHAT-09 | Error state shown if Vertex AI call fails | Phase 4 |

---

## Research Flags (Carry Into Planning)

These are known uncertainties from the research phase. Each must be resolved during the relevant phase — not before.

- **Phase 1 (Plan 01-02):** Actual token count of the three extracted megatrend docs is unknown until measured. Budget ceiling is 30,000 tokens. If exceeded, produce condensed summaries rather than injecting raw full-text. This decision gates Phase 3 context injection.

- **Phase 3 (Plan 03-01):** Confirm `@ai-sdk/google-vertex` current stable version and that `useChat` API is unchanged. If ADC auth fails in the AI SDK bridge layer, fall back to Path B (`@google-cloud/vertexai` direct SDK + manual `ReadableStream` bridging) immediately — do not debug the wrapper.

- **Phase 3 (Plan 03-02):** Vertex AI Grounding exact API config parameter is MEDIUM confidence. Verify against current `@google-cloud/vertexai` SDK docs during implementation — do not assume parameter names from training data.

- **Phase 4 (Plan 04-03):** Pedagogical QA cannot be signed off by engineering. Requires a session with someone who knows the FUND II curriculum (faculty or test student) to verify guardrail behavior. Plan 04-03 is not complete until this review has happened.

- **Before load testing:** Check GCP console under `Vertex AI > Quotas` for per-request input token quotas in the target region. May need to request an increase before the full student cohort uses the tool.

---

*Roadmap created: 2026-03-21*
*Milestone: MVP v1.0*
*Last updated: 2026-03-21 after initial roadmap creation*
