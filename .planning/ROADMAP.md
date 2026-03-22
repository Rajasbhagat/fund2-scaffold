# Roadmap: FUND II Trend Mapper

## Overview

This roadmap delivers MVP v1.0 of the FUND II Trend Mapper — a multi-project web application giving IESE MBA students a persistent AI thinking partner for trend exploration. The journey follows a strict dependency chain: the infrastructure and document extraction must be correct before any feature is testable; the data layer must be stable before the chat pipeline has anything to attach to; the streaming pipeline must be functional before UI polish is meaningful. Four phases, no parallelism, no shortcuts — the architecture demands this order.

## Milestone: MVP v1.0

**Goal:** A working, deployed web app where students can create trend exploration projects, open a persistent Trend Mapper chat in each project, receive streaming AI responses grounded in real web data and the FUND II megatrend knowledge base, and pick up exactly where they left off across browser sessions.

**Done when:** All 4 phases complete, agent guardrails manually verified against the FUND II spec, and the app is accessible at its deployment URL.

---

## Phases

- [x] **Phase 1: Foundation & Environment** - Scaffold the Next.js project, extract megatrend docs to plain text, wire Vertex AI ADC, and confirm the system context loads and the LLM responds *(completed 2026-03-21)*
- [x] **Phase 2: Project Management** - Build the dashboard and all project CRUD so students can create, rename, delete, and open named projects *(completed 2026-03-21)*
- [x] **Phase 3: Streaming Chat Pipeline** - Wire the core AI pipeline: Route Handler, streaming Vertex AI responses, full context injection, chat history persistence, and rolling window *(completed 2026-03-21)*
- [ ] **Phase 4: UI Polish & Agent Verification** - Markdown rendering, loading/error states, responsive layout, and manual QA of all pedagogical guardrails *(implementation complete — awaiting manual QA)*

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
| 2. Project Management | 5/5 | ✅ Complete | 2026-03-21 |
| 3. Streaming Chat Pipeline | 6/6 | ✅ Complete | 2026-03-21 |
| 4. UI Polish & Agent Verification | 5/6 | 🔄 Awaiting manual QA | - |

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

---

## Milestone: MVP v2.0

**Goal:** A single project workspace with all 4 AI agents (Trend Mapper, Value Designer, SPI, FARO) accessible via tabs, a global session tracker that gates each agent's behavior, internet access (standard + deep research) for all agents, and per-project document upload where uploaded docs take priority over web search results.

**Done when:** All 4 phases complete, all 4 agents respond correctly with web access, deep research toggle produces noticeably more thorough responses, uploaded docs are correctly prioritised in context, session tracker injects correctly, and system files are invisible to students.

---

### Phases

- [ ] **Phase 5: Multi-Agent Platform Shell** — DB migration (agentType on Message, AppSettings), agent tab UI within project, global session selector, deep research toggle UI
- [ ] **Phase 6: Value Designer & SPI Agents** — Wire VD and SPI with full system prompts + web search (googleSearch); deep research mode uses gemini-2.5-pro + urlContext
- [ ] **Phase 7: FARO Agent** — Extract FUND II + elective syllabi, wire FARO with knowledge base + web search for supplemental lookups
- [ ] **Phase 8: Document Upload + Context Priority** — Per-project PDF/PPTX/DOCX upload, text extraction, priority injection (uploaded docs → system docs → web search); global system docs hidden from UI
- [ ] **Phase 9: Unified Conversation Thread** — Replace isolated per-agent panels with a single shared conversation thread; inline agent picker selects responder without switching view; full history sent to every agent as context
- [x] **Phase 10: Aerospace HUD UI Redesign** *(parallel — can run alongside Phases 5–9)* — Full app retheme with Sci-Fi HUD design system; Rajdhani/JetBrains Mono fonts, neon yellow accent blocks, flat brutalist grid layout, HUD primitive component library (completed 2026-03-22)

---

### Phase Details

#### Phase 5: Multi-Agent Platform Shell
**Goal**: Every project has 4 agent tabs with isolated but persistent chat histories; a global session selector (1–10) is visible in the UI and stored in the DB; the current session number is injected into every agent's system prompt; a Deep Research toggle is available per message
**Depends on**: Phase 4
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, AGENT-09, SEARCH-02
**Success Criteria**:
  1. A project page shows 4 tabs: Trend Mapper, Value Designer, SPI, FARO — each with its own message thread
  2. Switching tabs does not clear chat history; returning to a tab shows the full prior conversation
  3. A session selector (1–10) is visible in the app; changing it persists across page refresh
  4. Every agent route handler receives the current session number and includes it in the system prompt
  5. Trend Mapper's existing messages migrate cleanly — messages get `agentType: 'trend-mapper'` and continue working
  6. A "Deep Research" toggle button is visible in the chat input area; when active, the POST body includes `deepResearch: true` and the route handler switches to gemini-2.5-pro + urlContext tool
  7. Agent tabs for locked agents (Trend Mapper at Session 2, Value Designer at Session 3, SPI at Session 7) are visibly disabled with an "Unlocks at Session X" label when the current session is below their threshold; FARO is always active

**Plans**: 3 plans
- [ ] 05-01: Prisma migration — add `agentType String @default("trend-mapper")` to `Message` model; add `AppSettings` model (`id`, `sessionNumber Int @default(1)`); run `prisma migrate dev`; seed one AppSettings row; update all existing Trend Mapper queries to filter by `agentType: 'trend-mapper'`
- [ ] 05-02: Session tracker API + UI — `GET/PATCH /api/settings/session` Route Handler; add session selector widget (1–10 dropdown or stepper) to the sidebar or project page header; fetch and update via client-side API call with optimistic UI
- [ ] 05-03: Agent tab navigation + deep research toggle — refactor `app/projects/[projectId]/page.tsx` to render 4 tabs; each tab loads its own message history (`agentType` filter); pass `agentType` and `currentSession` down to `ChatWindow`; update `ChatWindow` to pass `agentType` + `deepResearch` flag in POST body; add Deep Research toggle button to `ChatInput` (icon or checkbox beside send button) that flips a boolean state variable

---

#### Phase 6: Value Designer & SPI Agents
**Goal**: Value Designer and SPI are wired with their full system prompts, respond correctly in the app, each has its own Route Handler with web search enabled, and deep research mode activates Pro model + urlContext
**Depends on**: Phase 5
**Requirements**: AGENT-06, AGENT-07
**Success Criteria**:
  1. Sending a message in the Value Designer tab returns a streamed response from the VD agent — not the Trend Mapper
  2. VD agent opens with the correct mode-detection greeting (In-Session or Post-Session) and refuses to skip activity gates
  3. Sending a message in the SPI tab returns a streamed response from the SPI agent
  4. SPI generates a full persona profile when given venture context; stays in character; exits character and gives a debrief when student types END INTERVIEW
  5. Neither VD nor SPI uses web search — all responses are grounded in injected context and student input only
  6. Deep Research toggle is visible in VD and SPI tabs but disabled (grayed out with tooltip: "Deep Research is not available for this agent")

**Plans**: 3 plans
- [ ] 06-01: Extract VD and SPI system prompts to `src/context/agents/value-designer.txt` and `src/context/agents/spi.txt` from the spec `.txt` files; measure token counts; update `lib/context.ts` to export `getValueDesignerContext()` and `getSPIContext()` loaders
- [ ] 06-02: Implement `app/api/chat/value-designer/[projectId]/route.ts` — streamText with gemini-2.5-flash, no tools; inject VD system prompt + current session; message history filtered to `agentType: 'value-designer'`; same rolling window and persistence pattern as Trend Mapper
- [ ] 06-03: Implement `app/api/chat/spi/[projectId]/route.ts` — streamText with gemini-2.5-flash, no tools; SPI system prompt + current session injection; message history filtered to `agentType: 'spi'`; rolling window and persistence; update `ChatWindow` to route POST to the correct endpoint based on active agent tab

---

#### Phase 7: FARO Agent
**Goal**: FARO responds as the course navigator using the FUND II syllabus and elective syllabi as its primary knowledge base, with web search for supplemental ecosystem lookups; deep research mode available for thorough ecosystem questions
**Depends on**: Phase 5
**Requirements**: AGENT-08, SEARCH-01
**Success Criteria**:
  1. FARO answers questions about course sessions, readings, deadlines accurately (sourced from injected FUND II syllabus)
  2. FARO correctly routes students to other agents when they ask about tasks that belong to a specific co-pilot
  3. FARO adapts its response depth based on the current session (e.g. different context at Session 2 vs. Session 9)
  4. FARO's total injected context (system prompt + syllabi) is measured and confirmed within the token budget; summaries produced for any syllabi that push it over
  5. FARO uses web search to supplement ecosystem questions (e.g. current IESE events, professor bios) when the syllabi knowledge base doesn't have the answer

**Plans**: 2 plans
- [ ] 07-01: Extract FUND II syllabus + key elective syllabi to `src/context/faro/` (FUND II + NAVEI, VCIC, SEARCH, BMI, BMC, Corporate Ent, SEI, Entrepreneurial Finance — from the syllabi folder); measure combined token count; produce condensed summaries for any that exceed budget; implement `getFAROContext()` loader in `lib/context.ts` with context priority header
- [ ] 07-02: Implement `app/api/chat/faro/[projectId]/route.ts` — accept `deepResearch` boolean; standard mode: gemini-2.5-flash + FARO knowledge base + `googleSearch`; deep research mode: gemini-2.5-pro + `googleSearch` + `urlContext`; inject FARO system prompt + syllabi context + current session; message history filtered to `agentType: 'faro'`; rolling window and persistence

---

#### Phase 8: Document Upload + Context Priority
**Goal**: Students can upload PDF, PPTX, and DOCX files to a project; extracted text is injected as the highest-priority context before web search runs; system files are never visible in the UI
**Depends on**: Phase 5
**Requirements**: DOC-01, DOC-02, DOC-03, SEARCH-03
**Success Criteria**:
  1. A file upload area is visible within each project; student can upload PDF, PPTX, or DOCX
  2. After upload, the file name appears in the project's file list
  3. When the student sends a message to any agent, uploaded document text is injected into the system context BEFORE web search runs — the system prompt explicitly tells the model to consult these documents first
  4. The model demonstrably references uploaded document content in its response when the document is relevant (e.g. upload a persona document and ask Value Designer to use it)
  5. System files (syllabi, agent specs) are not listed or accessible anywhere in the student UI
  6. Uploading a file that exceeds 10 MB shows an inline error

**Plans**: 3 plans
- [ ] 08-01: Prisma migration — add `UploadedFile` model (`id`, `projectId`, `filename`, `originalName`, `mimeType`, `extractedText`, `createdAt`); FK to Project with cascade delete; run `prisma migrate dev`
- [ ] 08-02: File upload Route Handler — `POST /api/projects/[id]/files` (multipart, max 10 MB); extract text with mammoth (DOCX), pdf-parse (PDF), or pptx-extract/officegen (PPTX — install if not present); store extracted text in `UploadedFile.extractedText`; `GET /api/projects/[id]/files` returns file list (name, id — no extracted text); `DELETE /api/projects/[id]/files/[fileId]`
- [ ] 08-03: File upload UI + context priority wiring — upload button/dropzone beside the agent tabs; file list showing uploaded file names with delete affordance; update all 4 agent Route Handlers to assemble context in strict priority order: (1) agent system prompt, (2) current session number, (3) global system docs already injected by each loader (syllabi / megatrend docs / agent specs), (4) per-project uploaded docs with header `[STUDENT UPLOADED DOCUMENTS — highest priority for this project. Consult these before searching the web:\n[doc: filename]\n{text}\n...]`, (5) web search via `googleSearch` tool (Trend Mapper and FARO only); system prompt explicitly states: "Always prioritise pre-loaded course materials and student-uploaded documents over web search results."

---

#### Phase 9: Unified Conversation Thread
**Goal**: Replace the isolated per-agent chat panels with a single shared conversation thread per project. The student selects which agent responds via an inline picker above the input — switching agents does not clear or replace the conversation. Every agent receives the full shared history as context, eliminating the need to re-explain prior analysis when switching.
**Depends on**: Phase 8
**Requirements**: UNIF-01, UNIF-02, UNIF-03, UNIF-04, UNIF-05
**Success Criteria**:
  1. A project shows ONE conversation thread regardless of which agent is active — no panel switching, no history reset
  2. An inline 4-pill agent picker (TREND MAPPER / VALUE DESIGNER / SPI / FARO) above the input shows the active agent highlighted; clicking a different pill changes the target agent without altering the displayed messages
  3. Messages from different agents are labeled (e.g. "TREND MAPPER", "FARO") above each assistant bubble so the student can trace who said what
  4. Sending a message with FARO selected after a Trend Mapper exchange: FARO's response demonstrates awareness of the prior Trend Mapper content — it received the full history
  5. Student messages show as "YOU" with no agent attribution; agent label only appears on assistant messages

**Plans**: 3 plans
- [ ] 09-01: DB + API — make `agentType` nullable on `Message` (user messages don't require it); update all 4 route handlers to accept a `messages: {role, content, agentType?}[]` array (full client-side history) instead of building history from DB; format unified history into strict alternating user/model Vertex AI turns (merge consecutive same-role turns if needed); keep rolling window applied to the full unified history; route handlers still persist user message + assistant response to DB
- [ ] 09-02: Refactor AgentWorkspace — remove the per-agent `absolute inset-0` panel map; add `activeAgent` state (default `'trend-mapper'`); replace `AgentTabs` with a new `AgentPicker` component (4 labeled pills, selecting changes `activeAgent` state only — no panel switch); pass `activeAgent` down to a single `UnifiedChatWindow`; load ALL messages for the project at page load (no `agentType` filter in the Server Component query)
- [ ] 09-03: Update ChatWindow (unified mode) — rename to `UnifiedChatWindow` or add `unified` prop; `messages` state holds all agents' messages in one list; on submit, route POST to the correct endpoint for `activeAgent`; send full `messages` array in POST body; render each message with its `agentType` label for assistant messages using the existing `MessageBubble` + role label pattern; show active agent name in the thinking indicator

---

#### Phase 10: Aerospace HUD UI Redesign
**Goal**: The entire app is reskinned with the Aerospace Telemetry / Sci-Fi HUD design system — flat, brutalist technical grid aesthetic with pale icy-blue backgrounds, neon yellow accent blocks, deep slate typography, and geometric micro-copy decorations across every surface
**Depends on**: Phase 4 (functional baseline) — can run in parallel with Phases 5–9
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05, UI-06, UI-07, UI-08, UI-09, UI-10
**Success Criteria** (what must be TRUE):
  1. App loads with Rajdhani (or Chakra Petch) as the primary typeface and JetBrains Mono for all codes/coordinates/timestamps — no system fonts visible in the main UI
  2. Dashboard shows project list as instrument-panel cards with 1px slate borders, crosshairs at grid intersections, and a neon yellow (#ebff00) accent strip or block in the header — no rounded corners or shadows anywhere
  3. Project workspace renders the agent selector as a horizontal HUD tab strip with active-state bracket decorations `[ ]`, the chat panel and sidebar separated by a single 1px rule
  4. Chat messages display with a micro-copy agent label tag above each assistant bubble; ChatInput looks like a command console
  5. Session tracker reads as a monospace telemetry value; Deep Research toggle is a flat command switch with neon yellow active state
  6. At least one panel section uses a dotted/perforated background pattern

**Plans**: 3 plans
- [x] 10-01: Design foundation — install Rajdhani + Chakra Petch + JetBrains Mono via `next/font`; extend `tailwind.config` with `hud-bg` (#d2edea), `hud-fg` (#1a2024), `hud-accent` (#ebff00), `hud-panel` (#b1dbd8) colors, `borderRadius: { DEFAULT: '0' }` override, and `fontFamily` additions; add global CSS for flat baseline (no shadows, no gradients); create HUD primitive components: `HUDPanel`, `HUDLabel`, `HUDValue`, `HUDAccentBlock`, `Barcode`, `DotGrid`
- [x] 10-02: Dashboard redesign — restyle `ProjectList`, `ProjectCard`, and `CreateProjectForm` using the HUD system; 2-column layout (20% sidebar / 80% main) with a single 1px vertical rule; sidebar holds the app identity block + session tracker as monospace telemetry readout; main area renders project cards as bordered instrument panels with crosshair corner decorations and neon yellow accent block in the header strip; creation form styled as a flat command input zone
- [x] 10-03: Workspace + chat redesign — restyle `ProjectLayout`, `AgentWorkspace`, `AgentTabs` (→ HUD tab strip with bracket active states), `ChatWindow`, `MessageBubble` (micro-copy agent label above each bubble), `ChatInput` (command console), `FileUploadPanel` (data intake module), session picker (numbered 1–10 grid cells), and deep research toggle (flat switch with accent active state); apply DotGrid background pattern to at least one panel section

---

## v2.0 Progress

**Execution Order:** 5 → 6 → 7 → 8 (Phase 6 and 7 can run in parallel after Phase 5)

| Phase | Stories Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 5. Multi-Agent Platform Shell | 0/3 | ○ Pending | - |
| 6. Value Designer & SPI Agents | 0/3 | ○ Pending | - |
| 7. FARO Agent | 0/2 | ○ Pending | - |
| 8. Document Upload | 0/3 | ○ Pending | - |
| 9. Unified Conversation Thread | 0/3 | ○ Pending | - |
| 10. Aerospace HUD UI Redesign *(parallel)* | 3/3 | Complete   | 2026-03-22 |

---

## v2.0 Requirement Coverage

**v2 requirements: 14 total | Mapped: 14 | Unmapped: 0**

| Requirement | Description | Phase |
|-------------|-------------|-------|
| PLAT-01 | Agent tab switching with persistent chat histories | Phase 5 |
| PLAT-02 | Global session tracker (1–10) settable from UI | Phase 5 |
| PLAT-03 | Session number injected into all agent system prompts | Phase 5 |
| PLAT-04 | Session-gated agent tabs (locked/disabled below unlock threshold) | Phase 5 |
| AGENT-06 | Value Designer agent — 6-activity facilitation, no web search | Phase 6 |
| AGENT-07 | SPI agent — persona generation, in-character interview, debrief, no web search | Phase 6 |
| AGENT-08 | FARO agent — course navigation, syllabi knowledge base + web search | Phase 7 |
| AGENT-09 | All 4 agents present in every project | Phase 5 |
| SEARCH-01 | Trend Mapper + FARO have web search; VD + SPI do not | Phase 6 |
| SEARCH-02 | Deep Research toggle (Trend Mapper + FARO only) — gemini-2.5-pro + urlContext | Phase 5 |
| SEARCH-03 | Context priority: global system docs → project uploads → web search | Phase 8 |
| DOC-01 | User can upload PDF/PPTX/DOCX per project | Phase 8 |
| DOC-02 | Uploaded files extracted and injected as priority context | Phase 8 |
| DOC-03 | System docs pre-loaded globally, hidden from student UI | Phase 8 |
| UI-01 | HUD typography — Rajdhani/Chakra Petch + JetBrains Mono | Phase 10 |
| UI-02 | HUD color tokens in Tailwind config | Phase 10 |
| UI-03 | HUD primitive components (HUDPanel, HUDLabel, etc.) | Phase 10 |
| UI-04 | Dashboard as instrument-panel grid with crosshairs | Phase 10 |
| UI-05 | Workspace as HUD with agent tab strip | Phase 10 |
| UI-06 | Chat as telemetry stream with agent micro-labels | Phase 10 |
| UI-07 | Session tracker + deep research as telemetry/HUD controls | Phase 10 |
| UI-08 | File upload as data intake module | Phase 10 |
| UI-09 | Zero box-shadows, gradients, or rounded corners | Phase 10 |
| UI-10 | Dotted background pattern in at least one panel | Phase 10 |

---

## v2.0 Research Flags

- **Phase 7 (Plan 07-01):** Token count of all elective syllabi is unknown until extracted. FARO's knowledge base may exceed 30K tokens — measure and summarize as needed. Do not guess.
- **Phase 8 (Plan 08-02):** PPTX text extraction library is not yet installed. Options: `pptx-extract`, `officegen`, or converting via LibreOffice CLI. Verify availability during Phase 8 planning.
- **Phase 6 — No web search for VD/SPI (per spec):** Value Designer and SPI have no `googleSearch` tool — this matches their original specs (facilitation engines, not research tools). Deep Research toggle is disabled/grayed out for these two agents in the UI.
- **Phase 5 / Phase 6 — Deep Research implementation:** `thinkingConfig` / `budgetTokens` are not in the current `@ai-sdk/google-vertex` v4.0.93 type definitions. Deep research mode is implemented as: switch model to `gemini-2.5-pro` + add `urlContext` tool alongside `googleSearch`. This gives the Pro model's extended reasoning + ability to read full URLs. Do not attempt to pass `thinkingConfig` through the SDK — it will fail silently or error.
- **Phase 6 — googleSearch + urlContext on same call:** Verify that `googleSearch` and `urlContext` can be passed simultaneously in the `tools` array. Both are in the `googleVertexTools` export — this should work but confirm during Phase 6 implementation.
- **Phase 6 / Phase 7:** All agent route handlers will use the same ADC credentials pattern from Trend Mapper — reuse existing vertex instance, no re-verification needed.

---

---

## Milestone: v2.1 — AI-Powered Slide Generation

**Goal:** Students can generate polished, personalized PowerPoint slides directly from their agent conversations — one Trend Mapper slide covering the full 6-part output structure, and four Value Designer slides (Opportunity, Value Prop, Customer Segment, Business Model). Each slide type has a "Generate" button that unlocks progressively as conversation content becomes sufficient, ensuring generation only happens when the conversation is ready.

**Done when:** All 3 phases complete, all 5 slide types generate valid `.pptx` files that open in PowerPoint/Google Slides, buttons unlock correctly based on conversation depth, and slides are visually consistent with the HUD design system.

---

### Phases

- [ ] **Phase 11: Slide Schemas, Prompts, and Thresholds** — 5 flat Zod schemas (one per slide type) validated against real Gemini calls, 5 extraction system prompts, message-count unlock thresholds per slide type; the complete data contract before any rendering code is written
- [ ] **Phase 12: Slide Generation API Routes and PPTX Builders** — Full server-side pipeline: `app/api/slides/[type]/[projectId]/route.ts` with structured extraction via `generateText` + `Output.object()`, inline completeness check (422 early return), pptxgenjs HUD-styled builders for all 5 slide types, binary buffer response with correct MIME headers
- [ ] **Phase 13: Slide UI and AgentWorkspace Integration** — `SlideGenerateButton` component with two-stage unlock state, `SlidePanel` with one-way ready latch and debounce, wired into `AgentWorkspace` for Trend Mapper and Value Designer agents
- [ ] **Phase 14: Landing Page Prompt Generator** — "Create Landing Page" button unlocks after all 6 Value Designer milestones are complete; Gemini synthesizes a comprehensive vibe-coding prompt from all agent conversations; displayed in a modal with copy-to-clipboard

---

### Phase Details

#### Phase 11: Slide Schemas, Prompts, and Thresholds
**Goal**: The complete data contract for slide generation exists as validated TypeScript — 5 flat Zod schemas accepted by Vertex AI structured output, 5 extraction prompts that guide Gemini to fill those schemas from conversation content, and unlock threshold constants per slide type; all schemas verified with real Gemini calls before any rendering code is written
**Depends on**: Phase 10 (HUD design tokens exist for reference in builder phase)
**Requirements**: SLIDE-01 (threshold constants), SLIDE-07 (venture name field in schemas)
**Success Criteria** (what must be TRUE):
  1. Each of the 5 Zod schemas passes a real `generateText` + `Output.object()` call against Gemini 2.5 Flash without a `NoObjectGeneratedError` — validated with a test script or curl before Phase 12 begins
  2. All schema fields that may be absent from an early conversation are marked `.nullable()` — no required fields that Gemini would hallucinate content to satisfy
  3. Each schema includes a `ventureName` (or equivalent) nullable field so the venture name/topic can be extracted from the conversation and surfaced on the slide
  4. `src/lib/slides/thresholds.ts` exports named constants for each slide type's minimum message count — values are easy to change without touching other files
  5. `src/lib/slides/prompts.ts` exports extraction system prompts that instruct Gemini to return null for any field not yet evidenced in the conversation rather than inventing plausible content

**Plans**: TBD

---

#### Phase 12: Slide Generation API Routes and PPTX Builders
**Goal**: Students' conversations can be turned into downloadable `.pptx` files — the server pipeline filters messages by agent type, extracts structured slide content via Gemini, builds a HUD-styled PPTX in memory with pptxgenjs, and returns a binary buffer that the browser downloads directly; all 5 slide types verified to open correctly in PowerPoint and LibreOffice before UI is built
**Depends on**: Phase 11
**Requirements**: SLIDE-02, SLIDE-03, SLIDE-04, SLIDE-05, SLIDE-06, SLIDE-07, SLIDE-08
**Success Criteria** (what must be TRUE):
  1. `POST /api/slides/trend-mapper/[projectId]` with a sufficient conversation in the request body returns a `.pptx` binary response that opens in PowerPoint with HUD styling — neon yellow (#ebff00) header block, icy blue (#d2edea) body, dark (#1a2024) text
  2. The same endpoint returns a `422` with a human-readable `reason` field (and a `missingElements` array) when the conversation does not yet have enough content for extraction — not a 500, not a silent failure
  3. All 4 Value Designer slide endpoints (opportunity, value-prop, customer-segment, business-model) return valid `.pptx` files under the same conditions
  4. Each generated slide prominently displays the venture name or topic extracted from the conversation — the slide is identifiably about the student's specific project, not a generic template
  5. Null fields (content not yet in the conversation) render as `[Not yet defined — continue the conversation]` placeholder text rather than being omitted or hallucinated

**Plans**: TBD

---

#### Phase 13: Slide UI and AgentWorkspace Integration
**Goal**: Students can trigger slide generation from inside the agent workspace — a "Generate Slide" button per slide type appears when the active agent is Trend Mapper or Value Designer, is disabled with a tooltip until the message-count threshold is met, triggers a Gemini completeness check on first click after the threshold passes, and immediately downloads the `.pptx` if the check passes or shows a "keep chatting" message with missing elements if it does not; the button never re-locks once it has unlocked
**Depends on**: Phase 12
**Requirements**: SLIDE-01
**Success Criteria** (what must be TRUE):
  1. In a fresh Trend Mapper conversation with fewer messages than the threshold, the "Generate Trend Mapper Slide" button is visible but disabled — hovering it shows a tooltip explaining what content is needed
  2. After the conversation crosses the message-count threshold, the button becomes active; clicking it triggers the generation route and shows a loading state (not a spinner on the chat input — a distinct slide generation indicator)
  3. If the Gemini completeness check returns 422, the button remains enabled but shows an inline message listing the missing elements — the student is not left guessing what to add
  4. If generation succeeds, the browser downloads a `.pptx` file immediately — no intermediate save/open dialog beyond the browser's native download behavior
  5. Once a slide type has passed its completeness check, the button does not revert to disabled even if earlier messages are re-rendered — the one-way latch prevents re-locking

**Plans**: TBD

---

#### Phase 14: Landing Page Prompt Generator
**Goal**: After all 6 Value Designer milestones are complete, a "Create Landing Page" button appears in the SlidePanel. Clicking it calls a Gemini API that reads all agent conversations — Trend Mapper context, Value Designer persona/JTBD/solution, and SPI debrief if present — and synthesizes a comprehensive, copy-ready vibe-coding prompt. The student can copy the prompt and paste it directly into Bolt, Lovable, Cursor, or v0 to scaffold their venture's landing page.
**Depends on**: Phases 6, 13 (Value Designer agent + SlidePanel exist)
**Requirements**: LP-01, LP-02, LP-03, LP-04, LP-05
**Success Criteria** (what must be TRUE):
  1. The "Create Landing Page" button is NOT visible when fewer than 6 Value Designer milestones are complete; it becomes visible and enabled only when all 6/6 VD milestones are complete
  2. Clicking the button shows a loading state while Gemini processes the conversation; the button is disabled during generation
  3. The generated prompt contains: venture name, target user description, core value proposition, minimum 5 landing page sections with copy guidance, a feature list with at least 5 items, design aesthetic (colors, tone, visual style), and a routing/component scaffold for the chosen vibe-coding platform
  4. The prompt is formatted as clean markdown that can be pasted directly into a vibe-coding platform — no extra UI wrapper text leaks into the prompt
  5. A "Copy to Clipboard" button copies the full prompt; a toast confirms the copy

**Plans**: 2 plans

Plans:
- [ ] 14-01-PLAN.md — System prompt module + POST /api/landing-prompt/[projectId] route (Gemini synthesis from all agent conversations)
- [ ] 14-02-PLAN.md — LandingPromptModal component + SlidePanel VD milestone gate wiring

---

## v2.1 Progress

**Execution Order:** 11 → 12 → 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 11. Slide Schemas, Prompts, and Thresholds | 0/TBD | ○ Not started | - |
| 12. Slide Generation API Routes and PPTX Builders | 0/TBD | ○ Not started | - |
| 13. Slide UI and AgentWorkspace Integration | 0/TBD | ○ Not started | - |
| 14. Landing Page Prompt Generator | 0/2 | ○ Not started | - |

---

## v2.1 Requirement Coverage

**v2.1 requirements: 8 total | Mapped: 8 | Unmapped: 0**

| Requirement | Description | Phase |
|-------------|-------------|-------|
| SLIDE-01 | Two-stage unlock: message-count heuristic + Gemini completeness check | Phase 11 (thresholds) + Phase 13 (UX) |
| SLIDE-02 | Trend Mapper slide (.pptx, 6-part structure) | Phase 12 |
| SLIDE-03 | Value Designer Opportunity slide (.pptx) | Phase 12 |
| SLIDE-04 | Value Designer Value Proposition slide (.pptx) | Phase 12 |
| SLIDE-05 | Value Designer Customer Segment slide (.pptx) | Phase 12 |
| SLIDE-06 | Value Designer Business Model slide (.pptx) | Phase 12 |
| SLIDE-07 | Venture name extracted from conversation and featured on each slide | Phase 11 (schema field) + Phase 12 (rendered) |
| SLIDE-08 | Generated slides use HUD design language (#ebff00, #d2edea, #1a2024) | Phase 12 |

---

## v2.1 Research Flags

- **Phase 11 execution:** Validate each Zod schema with a real `generateText` + `Output.object()` call before writing any pptxgenjs builder. If a schema fails Vertex AI structured output validation, flatten it further (remove nesting, reduce field count) and re-test before proceeding. Complex schemas are silently rejected; flat is always safer.
- **Phase 12 (Plan for binary response):** Verify `new Response(buffer)` vs `new Response(new Uint8Array(buffer))` on the installed Node.js version. PITFALLS.md flags this as a known gotcha; test at the start of Phase 12 before building all 5 builders.
- **Phase 12 — `generateText` import path:** `generateObject` is deprecated in `ai@6.0.134`. The correct pattern is `generateText` with `Output.object({ schema })`. Verify the exact import path from `node_modules/ai/` before writing any extraction route.
- **Phase 13 — agentType filter for legacy messages:** Trend Mapper messages from v1.0 may have `agentType: null`. The slide route must use `OR: [{ agentType: 'trend-mapper' }, { agentType: null }]` when filtering — not just `agentType: 'trend-mapper'`. Missing this causes slide extraction to silently use zero messages from legacy projects.

---

*Roadmap created: 2026-03-21*
*Milestone: MVP v1.0 — complete*
*Milestone: MVP v2.0 — added 2026-03-21*
*Milestone: v2.1 AI-Powered Slide Generation — added 2026-03-22*
*Last updated: 2026-03-22 after v2.1 roadmap (Phases 11–13) added*
