# FUND II AI Agent Platform

## What This Is

A multi-agent AI co-pilot suite for IESE MBA students enrolled in Fundamentals of Entrepreneurial Management II (FUND II). The platform gives students a single persistent workspace with four specialized AI agents — Trend Mapper, Value Designer, SPI, and FARO — that guide them through every session of the hackathon course from trend exploration to final pitch. One project = one student team's venture, accessed from a shared single-user workspace.

## Core Value

Each project gives the student team a persistent, spec-faithful set of AI thinking partners that adapt to where the team is in the course arc — with no repeated context-setting, no losing work between sessions.

## Requirements

### Validated (MVP v1.0 — completed 2026-03-21)

- ✓ Projects: create, rename, delete, open (PROJ-01 to 05)
- ✓ Trend Mapper chat: streaming Vertex AI responses with Grounding — Phase 1
- ✓ Full system prompt + megatrend docs injected on every request — Phase 1
- ✓ Chat history persisted per project across sessions (SQLite) — Phase 1
- ✓ Rolling window to stay within token limits — Phase 1
- ✓ Markdown rendering, loading/error states, responsive layout — Phase 1

### Active (MVP v2.0)

- [ ] All 4 agents (Trend Mapper, Value Designer, SPI, FARO) available via tabs within every project
- [ ] Switching between agents preserves each agent's full chat history
- [ ] Global session tracker (Session 1–10) visible in the app; all agents receive current session in their system prompt
- [ ] Value Designer: sequential 6-activity facilitation engine, no web search
- [ ] SPI: persona generation (Customer / Investor / Partner) + in-character interview + END INTERVIEW debrief
- [ ] FARO: course navigation agent with FUND II + elective syllabi knowledge base
- [ ] User can upload PDF, PPTX, DOCX per project; extracted text injected into active agent's context
- [ ] System documents (syllabi, agent specs) pre-loaded globally and hidden from the student UI

### Out of Scope

| Feature | Reason |
|---------|--------|
| User authentication | Single-user MVP — multi-user and auth deferred to v3 |
| MVP Builder agent | Not in spec for this milestone |
| Pivot Coach agent | Not in spec for this milestone |
| Pitch Academy agent | Not in spec for this milestone |
| Real-time collaboration | Multi-user deferred to v3 |
| Mobile app | Web-first; responsive web sufficient |
| Miro integration | Out of scope — agents remind students to copy to Miro manually |
| RAG / vector search | Full injection fits within Gemini's context window |

## Context

- **Codebase**: Next.js 14 (actually 16.2.1), TypeScript, Tailwind, shadcn/ui, Prisma 7 + SQLite (WAL mode), Vertex AI Gemini 2.5 Flash with ADC credentials
- **Agent specs**: All 4 agent specs extracted to `.txt` in their respective folders
- **Syllabi folder**: `ENTRE syllabi - FUND I II and Electives/` — FUND II syllabus + all elective syllabi for FARO's knowledge base
- **Megatrend docs**: Already extracted to `src/context/` from v1.0
- **Existing architecture**: `Project` → `Message` (projectId FK). v2.0 adds `agentType` to `Message`, `AppSettings` table, and file upload storage.
- **Single user**: No auth, no multi-tenancy for this milestone

## Constraints

- **Token budget**: Gemini 2.5 Flash has a large context window but FARO injects multiple syllabi — must measure and fit within ~30K token budget per request or summarize
- **File extraction**: PDF (pdf-parse already installed), DOCX (mammoth already installed), PPTX (need officegen or pptx2json)
- **Tech stack**: Must stay on Next.js + Vertex AI — no platform switch
- **Single user**: No sessions/auth complexity

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add `agentType` to `Message` model | Simplest migration — avoids new AgentThread table, preserves all existing Trend Mapper history | — Pending |
| Global session tracker in AppSettings | Single user; session progresses linearly for everyone | — Pending |
| Full injection over RAG | Gemini's context window is large enough; full injection is simpler and more reliable | ✓ Good (validated in v1.0) |
| Per-project uploads in `uploads/[projectId]/` | Simple filesystem storage; avoids DB blob complexity | — Pending |
| Value Designer: no web search | Per spec — facilitation engine, not research tool | — Pending |
| SPI: no web search | Per spec — all context comes from student input | — Pending |
| FARO: no web search | Per spec — retrieval + synthesis from pre-loaded knowledge base | — Pending |

---
*Created: 2026-03-21 — v2.0 planning session*
*Last updated: 2026-03-21 after v2.0 project initialization*
