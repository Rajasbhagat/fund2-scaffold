# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-21)

**Core value:** Each project gives the student team a persistent, spec-faithful set of AI thinking partners that adapt to where the team is in the course arc.
**Current focus:** MVP v2.0 — Phase 5 next (multi-agent platform shell)

## Current Status

**Milestone:** MVP v2.0 (v1.0 complete 2026-03-21, manual QA for AGENT-04/05 still pending)
**Phase:** 5 of 8 (next — not started)
**Status:** v2.0 planning complete. Ready to execute Phase 5.

## Phase Overview

| Phase | Name | Status | Requirements |
|-------|------|--------|--------------|
| 1 | Foundation & Environment | ✅ Complete | ENV-01–04 |
| 2 | Project Management | ✅ Complete | PROJ-01–05 |
| 3 | Streaming Chat Pipeline | ✅ Complete | CHAT-01–06, AGENT-01–05 |
| 4 | UI Polish & Agent Verification | 🔄 Awaiting manual QA | CHAT-07–09 |
| 5 | Multi-Agent Platform Shell | ○ Pending | PLAT-01–03, AGENT-09 |
| 6 | Value Designer & SPI Agents | ○ Pending | AGENT-06–07 |
| 7 | FARO Agent | ○ Pending | AGENT-08 |
| 8 | Document Upload | ○ Pending | DOC-01–03 |

## Phase 1 Completion Notes (2026-03-21)
- Next.js 14 scaffolded, TypeScript + Tailwind working
- Prisma 7 + SQLite + WAL mode + global singleton (driver adapter pattern)
- Megatrend docs extracted to src/context/*.txt
- getSystemContext() loader wired and verified (~128K chars)
- Vertex AI smoke test passing — model: gemini-2.5-flash on socratoys/us-central1

## Phase 2 Completion Notes (2026-03-21)
- US-001 ✅ Prisma schema (Project + Message models, cascade delete, composite index)
- US-002 ✅ CRUD Route Handlers (GET/POST /api/projects, GET/PATCH/DELETE /api/projects/[id])
- US-003 ✅ Dashboard Server Component (async, queries Prisma directly)
- US-004 ✅ ProjectCard + CreateProjectForm + ProjectList (optimistic UI, no page reload)
- US-005 ✅ Project routing /projects/[projectId] with not-found handling and back nav
- Branch: ralph/phase-2-project-management

## Phase 3 Completion Notes (2026-03-21)
- US-001 ✅ Streaming route handler (ai v6 streamText + toTextStreamResponse)
- US-002 ✅ Full context injection — system prompt + megatrend docs as system param
- US-003 ✅ Vertex AI Grounding — tools: { google_search: vertex.tools.googleSearch({}) }
- US-004 ✅ Chat history persistence + rolling window (first 4 + last 40 messages)
- US-005 ✅ ChatWindow + ChatInput client components with streaming state
- US-006 ✅ End-to-end wiring (Server Component hydration of initial history)
- Key discovery: ai v6 uses role: 'assistant' (not 'model') — conversion required on DB read
- Branch: ralph/phase-3-streaming-chat

## Phase 4 Completion Notes (2026-03-21)
- US-001 ✅ MessageBubble.tsx (react-markdown + remark-gfm + Tailwind prose)
- US-002 ✅ Loading indicator (ThinkingIndicator — spinner/dots on send, hides on first token)
- US-003 ✅ Error handling in Route Handler + inline error with retry button in ChatWindow
- US-004 ✅ HTTP headers on streaming route (X-Accel-Buffering, Cache-Control, X-Content-Type-Options)
- US-005 ✅ Responsive layout — collapsible sidebar + main chat panel, no overflow
- US-006 ❌ GUARDRAIL_QA.md created — **awaiting manual human QA sign-off**
- MessageBubble wired into ChatWindow (maps 'assistant' → 'model' for prop type)
- Branch: ralph/phase-4-ui-polish

## Phase 10 Progress

| Plan | Name | Status |
|------|------|--------|
| 10-01 | Design Foundation — next/font, Tailwind v4 @theme HUD Tokens, HUD Primitive Library | ✅ Complete |
| 10-02 | Dashboard Redesign — 2-Column HUD Layout, Instrument Panel Cards, Accent Header | ✅ Complete |

## Decisions (Phase 10)

- Used Rajdhani via next/font/google with discrete weights (non-variable font)
- Tailwind v4 @theme block provides HUD token classes: bg-hud-fg, bg-hud-accent, bg-hud-panel, bg-hud-bg
- All border-radius tokens zeroed globally via @theme — flat UI enforced without per-element classes
- HUDPanel primitive encapsulates crosshair accent corners — replaces manual span patterns in ProjectCard
- 2-column dashboard: w-56 sidebar with DotGrid background + flex-1 main area
- HUDAccentBlock used as neon yellow header strip satisfying UI-05

## Next Action

**Phase 10 plans 01 and 02 complete.** Remaining plans (10-03+) cover workspace/chat/agent panel restyling.

---
*Initialized: 2026-03-21*
*Last updated: 2026-03-22 after Phase 10 Plan 02 complete*
