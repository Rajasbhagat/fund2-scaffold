# Requirements: FUND II Trend Mapper

**Defined:** 2026-03-21
**Core Value:** Each project has a persistent, spec-faithful Trend Mapper conversation that guides students from fuzzy trend ideas to specific, evidence-backed opportunity framing.

## v1 Requirements

### Environment Setup

- [x] **ENV-01**: Megatrend documents (.docx, .pdf) are extracted to plain text and stored as static context files
- [x] **ENV-02**: Extracted context total token count is verified to be within Gemini's budget
- [x] **ENV-03**: Vertex AI ADC credentials are wired and verified with a test call
- [x] **ENV-04**: SQLite WAL mode is enabled and Prisma singleton pattern is applied

### Projects

- [x] **PROJ-01**: User can create a new project with a name
- [x] **PROJ-02**: User can view all projects on a dashboard
- [x] **PROJ-03**: User can rename a project
- [x] **PROJ-04**: User can delete a project (with confirmation)
- [x] **PROJ-05**: User can open a project and enter its chat view

### Chat

- [x] **CHAT-01**: Each project has its own isolated chat thread
- [x] **CHAT-02**: Chat streams responses from Vertex AI Gemini in real time
- [x] **CHAT-03**: Chat history persists per project across browser sessions (stored in SQLite)
- [x] **CHAT-04**: Full system prompt (from FUND_II_Trend_Mapper_System_Prompt.txt) is injected on every request
- [x] **CHAT-05**: All three megatrend documents are injected as knowledge base context on every request
- [x] **CHAT-06**: Chat history rolling window is applied to avoid exceeding token limits
- [x] **CHAT-07**: Agent responses render markdown (bold, lists, headers)
- [x] **CHAT-08**: Loading state is shown while agent is responding
- [x] **CHAT-09**: Error state is shown if Vertex AI call fails

### Agent Behavior

- [x] **AGENT-01**: Agent operates in Pre-Class mode (structured 6-slide scaffolding workflow)
- [x] **AGENT-02**: Agent operates in In-Class mode (S-curve, 2x2 grid, trend-to-problem mapping)
- [x] **AGENT-03**: Agent uses Vertex AI Grounding (web search) to find real data and cite sources
- [ ] **AGENT-04**: All guardrails are enforced — *pending manual QA (GUARDRAIL_QA.md)*
- [ ] **AGENT-05**: Terminology discipline enforced — *pending manual QA (GUARDRAIL_QA.md)*

## v2 Requirements (MVP v2.0 — active milestone)

### Platform

- [ ] **PLAT-01**: User can switch between all 4 agents within a project using a tabbed interface, without losing chat history for any agent
- [ ] **PLAT-02**: A global session tracker (Session 1–10) is visible and settable from the main UI
- [ ] **PLAT-03**: The current session number is injected into every agent's system prompt so behavior is session-aware

### New Agents

- [ ] **AGENT-06**: Value Designer agent is available in every project — sequential 6-activity facilitation workflow, no web search, session-aware
- [ ] **AGENT-07**: SPI (Synthetic Persona Interviewer) agent is available in every project — generates Customer / Investor / Partner personas, sustains in-character interviews, provides structured debrief on END INTERVIEW, no web search
- [ ] **AGENT-08**: FARO agent is available in every project — course navigation, routing to other agents, FUND II + elective syllabi knowledge base, web search enabled, session-aware course arc awareness
- [ ] **AGENT-09**: All 4 agents are present in every project from creation — no per-project agent selection required

### Search & Research

- [ ] **SEARCH-01**: Trend Mapper and FARO have web search enabled (Vertex AI Grounding via `googleSearch` tool); Value Designer and SPI do not — they are facilitation engines
- [ ] **SEARCH-02**: A "Deep Research" toggle is available per message for Trend Mapper and FARO — activates gemini-2.5-pro model + `googleSearch` + `urlContext` tools for exhaustive multi-step research
- [ ] **SEARCH-03**: Context priority order is enforced across all agents: (1) global system documents, (2) per-project uploaded documents, (3) web search — system prompt explicitly instructs the model to consult pre-loaded and uploaded docs before searching the web

### Documents

- [ ] **DOC-01**: User can upload PDF, PPTX, and DOCX files per project; files are stored and associated with that project
- [ ] **DOC-02**: Uploaded files are extracted to plain text and injected into the active agent's context before web search runs — uploaded docs take priority over internet results
- [ ] **DOC-03**: System documents (syllabi, agent specs) are pre-loaded globally at server startup and never visible in the student UI

## v3 Requirements (deferred)

### Auth & Multi-User

- **AUTH-01**: User sign-up and login (email/password)
- **AUTH-02**: Projects are scoped to authenticated user accounts
- **AUTH-03**: Session persistence tied to user identity

### Export

- **EXP-01**: User can export slide content as PDF or text
- **EXP-02**: User can copy individual slide drafts to clipboard

### Analytics

- **ANALYTICS-01**: Professor dashboard showing project activity
- **ANALYTICS-02**: Track which trends students are exploring

## Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication | MVP — single shared workspace reduces scope significantly |
| RAG / vector search over docs | Gemini 1.5 Pro 1M context window makes this unnecessary; full injection is simpler |
| Custom web search pipeline | Vertex AI Grounding handles this natively |
| Multiple AI agents in one project | Out of spec — Trend Mapper only for this milestone |
| Real-time collaboration | Single-user workspace for MVP |
| Mobile-native app | Web-first; responsive web is sufficient |
| Custom Gemini model fine-tuning | Standard model + system prompt is sufficient per spec |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| ENV-01 | Phase 1 | ✅ Complete |
| ENV-02 | Phase 1 | ✅ Complete |
| ENV-03 | Phase 1 | ✅ Complete |
| ENV-04 | Phase 1 | ✅ Complete |
| PROJ-01 | Phase 2 | ✅ Complete |
| PROJ-02 | Phase 2 | ✅ Complete |
| PROJ-03 | Phase 2 | ✅ Complete |
| PROJ-04 | Phase 2 | ✅ Complete |
| PROJ-05 | Phase 2 | ✅ Complete |
| CHAT-01 | Phase 3 | ✅ Complete |
| CHAT-02 | Phase 3 | ✅ Complete |
| CHAT-03 | Phase 3 | ✅ Complete |
| CHAT-04 | Phase 3 | ✅ Complete |
| CHAT-05 | Phase 3 | ✅ Complete |
| CHAT-06 | Phase 3 | ✅ Complete |
| CHAT-07 | Phase 4 | ✅ Complete |
| CHAT-08 | Phase 4 | ✅ Complete |
| CHAT-09 | Phase 4 | ✅ Complete |
| AGENT-01 | Phase 3 | ✅ Complete |
| AGENT-02 | Phase 3 | ✅ Complete |
| AGENT-03 | Phase 3 | ✅ Complete |
| AGENT-04 | Phase 3 | 🔄 Pending manual QA |
| AGENT-05 | Phase 3 | 🔄 Pending manual QA |
| PLAT-01 | Phase 5 | ○ Pending |
| PLAT-02 | Phase 5 | ○ Pending |
| PLAT-03 | Phase 5 | ○ Pending |
| AGENT-06 | Phase 6 | ○ Pending |
| AGENT-07 | Phase 6 | ○ Pending |
| AGENT-08 | Phase 7 | ○ Pending |
| AGENT-09 | Phase 5 | ○ Pending |
| SEARCH-01 | Phase 6 | ○ Pending |
| SEARCH-02 | Phase 5 | ○ Pending |
| SEARCH-03 | Phase 8 | ○ Pending |
| DOC-01 | Phase 8 | ○ Pending |
| DOC-02 | Phase 8 | ○ Pending |
| DOC-03 | Phase 8 | ○ Pending |

**Coverage:**
- v1 requirements: 23 total — all mapped ✓
- v2 requirements: 14 total — all mapped ✓
- Unmapped: 0
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-21*
*Last updated: 2026-03-21 after initial definition*
