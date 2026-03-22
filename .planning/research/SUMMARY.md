# Project Research Summary

**Project:** FUND II — AI-Powered Slide Generation (v2.1 milestone)
**Domain:** AI-powered .pptx generation from multi-agent chat conversations (pedagogical MBA tool)
**Researched:** 2026-03-22
**Confidence:** HIGH

---

## Executive Summary

This milestone adds AI-powered slide generation on top of a working multi-agent chat platform (Next.js 16.2.1, Prisma 7 + SQLite, ai@6.0.134, Vertex AI Gemini 2.5 Flash). The feature surface is minimal but the integration is precise: one new package (`pptxgenjs@4.0.1`), one new API route family (`app/api/slides/[type]/[projectId]/route.ts`), and two new client components (`SlidePanel`, `SlideGenerateButton`). No DB schema changes, no new auth, no new infrastructure — stateless generation on demand.

The recommended approach is a strict server-side pipeline: client sends the full message history in the POST body, the route handler filters to agent-relevant turns, calls `generateText` with `Output.object()` (the current AI SDK v6 pattern — `generateObject` is deprecated and scheduled for removal), extracts structured slide data via a flat Zod schema, builds the PPTX in memory with pptxgenjs, and returns a binary response. The pedagogical core of the feature — progressive disclosure — is implemented as a two-stage unlock: a cheap message-count heuristic runs client-side on every render; a Gemini completeness check runs inline in the generation route only when the student actually clicks Generate and the count threshold is met.

The primary risks are correctness risks, not architectural ones. The top three: (1) Zod schema fields must be `.nullable()` to prevent Gemini from hallucinating content for absent fields; (2) the `agentType` filter must be applied to all message queries or cross-agent content contaminates slide extraction; (3) the completeness check must be implemented with a one-way latch and debounce from day one — calling Gemini on every chat render is a real-money mistake. All three are preventable with upfront discipline and do not require rework once in place.

---

## Key Findings

### Recommended Stack

The existing stack requires exactly one new package. `pptxgenjs@4.0.1` is the only addition needed — it is the de-facto JavaScript PPTX library, has zero runtime dependencies, ships TypeScript definitions, and its `write('nodebuffer')` method returns a `Promise<Buffer>` suitable for a Next.js API route response. All other capabilities (structured AI extraction, Zod schema validation, file download trigger) are already present in the installed stack.

The critical API note: `generateObject` is deprecated in `ai@6.0.134`. The current pattern is `generateText` with `output: Output.object({ schema })`. Using the deprecated API risks a breaking change in a future patch. The route must declare `export const runtime = 'nodejs'` — pptxgenjs uses Node.js built-ins and is incompatible with the edge runtime.

**Core technologies:**
- `pptxgenjs@4.0.1`: PPTX file generation — only new dependency; zero transitive deps; Node.js only; `write('nodebuffer')` returns Buffer for direct HTTP response
- `generateText` + `Output.object()` from `ai@6.0.134`: structured slide content extraction — replaces deprecated `generateObject`; already installed; same `createVertex` instance as streaming routes
- `zod` (bundled with `ai`): slide content schemas — already present; keep schemas flat (max 1 level of nesting) to avoid Vertex AI structured output rejections

See `.planning/research/STACK.md` for full API reference patterns and code samples.

### Expected Features

Five slide types map directly to the pedagogical arc: Trend Mapper (6-part structure), and four Value Designer slides (Opportunity Statement, Value Proposition, Customer Segment, Business Model). Each has its own Zod extraction schema derived from the agent system prompt's activity structure.

**Must have (table stakes) — v2.1:**
- Generate Slide button per slide type with disabled state and explanatory tooltip — locked features must explain themselves
- Two-stage unlock: message-count heuristic (cheap, client-side) gates Gemini completeness check (inline in generation route on first click)
- `.pptx` download via `Content-Disposition: attachment` — MBA students must open in PowerPoint or Google Slides
- Loading state during generation (2–15 second wait) — no spinner means double-clicks and confusion
- Slide content derived from the actual conversation — null fields render as `[Not yet defined — continue the conversation]`, not hallucinated content

**Should have (differentiators) — v2.1:**
- Per-type progressive unlocking tied to pedagogical readiness — the unlock sequence IS the course feedback loop
- `missingElements` array surfaced in tooltip when not ready — tells students exactly what content is absent
- HUD-consistent slide styling (neon yellow `#ebff00` header, icy blue `#d2edea` body, dark `#1a2024` text) — visual coherence with the app

**Defer (v2+):**
- Slide storage / re-download — re-generation on demand is sufficient while conversations are already persisted
- Google Slides direct export — requires OAuth per user, explicitly out of scope for v2.1
- HTML slide preview — requires a separate renderer (Reveal.js); not worth the complexity
- Editable fields before generation — re-chatting is the correct feedback loop; a form UI adds frontend complexity with no pedagogical benefit

See `.planning/research/FEATURES.md` for full Zod schemas, threshold tables, and the complete feature prioritization matrix.

### Architecture Approach

The integration adds one dedicated route family and two components without modifying any existing files except `AgentWorkspace.tsx` (to mount `SlidePanel`). The separation is clean: chat routes own streaming SSE; slide routes own blocking structured extraction + binary response. These two response shapes cannot share a handler — `streamText` commits to an SSE response immediately; `generateText` with `Output.object()` is blocking and returns JSON. Client state for slide buttons is entirely derived — `thresholdMet` recomputes from the messages array on every render; `isGenerating` and `lastError` are transient `useState` with no DB backing.

**Major components:**
1. `app/api/slides/[type]/[projectId]/route.ts` — POST handler: message filtering, `generateText`+`Output.object()` extraction, pptxgenjs build, Buffer response with PPTX headers
2. `src/components/SlidePanel.tsx` — owns `SlideButtonState` map; receives `messages[]` and `activeAgent` as props; mounts 5 `SlideGenerateButton` instances; implements one-way latch
3. `src/lib/slides/` — server-only modules: `schemas.ts` (5 flat Zod schemas), `builders.ts` (5 pptxgenjs template functions), `thresholds.ts` (message count constants), `prompts.ts` (extraction system prompts)

See `.planning/research/ARCHITECTURE.md` for full data flow diagrams and the 5-step build order with test methods.

### Critical Pitfalls

1. **pptxgenjs imported in client bundle** — Import only inside `app/api/` routes; add `import 'server-only'` to any `src/lib/slides/` utility module on day one. Failure mode: `Module not found: Can't resolve 'fs'` at `next build`.

2. **All Zod schema fields required — Gemini hallucinates absent content** — Mark fields that may be absent as `.nullable()`. Required fields force Gemini to invent plausible content when the conversation hasn't covered that topic. Use `[Not yet defined]` placeholders in the PPTX instead.

3. **Wrong `agentType` filter on message queries** — Always filter messages by both `projectId` AND `agentType`. For legacy Trend Mapper messages (v1.0, null agentType), use `OR: [{ agentType: 'trend-mapper' }, { agentType: null }]`. Missing filter produces cross-agent slide contamination intermittently.

4. **Completeness check called on every render** — Implement a one-way latch (`Set<string>` of ready slide types, never removes entries) and debounce (check only on assistant message completion, not streaming chunks). Calling Gemini per render burns tokens and adds perceptible latency to every chat turn.

5. **Corrupt PPTX download** — Use the exact MIME type `application/vnd.openxmlformats-officedocument.presentationml.presentation` and `Content-Disposition: attachment`. Do not use `NextResponse.json()` for binary responses — it corrupts the buffer. Smoke-test each slide type against PowerPoint/LibreOffice before adding UI.

See `.planning/research/PITFALLS.md` for all 10 critical pitfalls, recovery strategies, and the "Looks Done But Isn't" verification checklist.

---

## Implications for Roadmap

The architecture's own 5-step build order — server-side pipeline first, UI last — is the right phase structure. Each step is independently verifiable before the next begins, which is essential because binary file delivery and structured output failures are both invisible to the browser until the full pipeline is complete.

### Phase 1: Slide Schemas, Prompts, and Thresholds
**Rationale:** All downstream work depends on the Zod schemas being correct and accepted by Vertex AI structured output. Flat schemas must be validated with real Gemini calls before any rendering code is written. Fixing schema complexity is cheap at this stage and expensive after pptxgenjs templates are built on top of them.
**Delivers:** `src/lib/slides/schemas.ts` (5 flat Zod schemas), `prompts.ts` (5 extraction system prompts), `thresholds.ts` (message count constants per slide type)
**Addresses:** Foundation for slide content derived from actual conversation; null-safe field design
**Avoids:** Pitfall 10 (complex Zod schema rejected by Vertex AI), Pitfall 3 (hallucinated required fields)
**Research flag:** Standard patterns — straightforward TypeScript/Zod authoring; no phase research needed. Validate each schema with a real Gemini call as part of phase execution before moving on.

### Phase 2: Slide Generation API Route (JSON extraction prototype)
**Rationale:** Build the route returning structured JSON (not yet PPTX) so the extraction pipeline can be verified with `curl` before pptxgenjs is introduced. This decouples schema correctness from file delivery correctness — two independent failure modes that are much harder to debug when combined.
**Delivers:** `app/api/slides/[type]/[projectId]/route.ts` returning structured JSON 200 (or 422 with human-readable reason); `export const runtime = 'nodejs'`; `export const maxDuration = 60`; `agentType` filter with null-safe legacy handling; `NoObjectGeneratedError` caught and returned as 422
**Uses:** `generateText` + `Output.object()` from `ai@6.0.134`, `createVertex` (same instance as chat routes), message filtering from POST body
**Avoids:** Pitfall 4 (`NoObjectGeneratedError` unhandled), Pitfall 5 (wrong agentType filter), Pitfall 8 (context budget blown — strip megatrend docs from extraction prompt), Pitfall 9 (timeout without maxDuration)
**Research flag:** Standard patterns — existing chat routes establish the template; adapt and verify. No phase research needed.

### Phase 3: pptxgenjs Slide Builders and Binary Response
**Rationale:** With the extraction pipeline verified, add pptxgenjs rendering and wire the binary buffer response. Smoke-test each of the 5 slide types with PowerPoint and LibreOffice before any UI is built — corrupt PPTX files destroy trust immediately and are hard to diagnose after the UI masks the raw response.
**Delivers:** `src/lib/slides/builders.ts` (5 HUD-styled PPTX template functions, 16:9 widescreen, HUD color tokens); slide route updated to return PPTX buffer with correct MIME type and `Content-Disposition: attachment`
**Uses:** `pptxgenjs@4.0.1`, `write('nodebuffer')`, HUD tokens (#ebff00 header, #d2edea body, #1a2024 text)
**Avoids:** Pitfall 1 (pptxgenjs in client bundle — add `import 'server-only'` to all slide lib modules here), Pitfall 2 (wrong binary response headers)
**Research flag:** Standard patterns — pptxgenjs documentation is authoritative and complete. No phase research needed. Note: verify `new Uint8Array(buffer)` compatibility vs direct `Buffer` in `new Response()` on the installed Node.js version.

### Phase 4: SlideGenerateButton and SlidePanel UI
**Rationale:** Client components built after the API contract is fixed and verified. The one-way latch and debounce for the completeness check must be implemented from the start — these are not optimizations to add later. Retrofitting them after students report confusing button behavior is avoidable.
**Delivers:** `SlideGenerateButton.tsx` (threshold + loading + error states, generates and downloads via blob URL); `SlidePanel.tsx` (owns `SlideButtonState` map, one-way ready latch, receives messages and activeAgent as props)
**Addresses:** All table stakes — loading state, disabled state with tooltip, `missingElements` feedback, HUD-consistent styling
**Avoids:** Pitfall 6 (completeness check over-firing — one-way latch + debounce), Pitfall 7 (button re-locking — one-way latch)
**Research flag:** Standard patterns — React state management for a button component; no phase research needed.

### Phase 5: AgentWorkspace Integration and End-to-End Verification
**Rationale:** Wire SlidePanel into AgentWorkspace, filter visibility to Trend Mapper and Value Designer agents only, and run the "Looks Done But Isn't" checklist against real conversations — including projects that have messages from multiple agents and projects with null-agentType legacy messages.
**Delivers:** Full end-to-end slide generation flow in the running app; verified against multi-agent and legacy message projects; correct agent-tab scoping; descriptive filenames (`fund2-trend-mapper-2026-03-22.pptx`)
**Addresses:** Per-agent progressive disclosure, agent-tab visibility scoping
**Avoids:** Pitfall 5 (agentType filter — full integration test), cross-agent contamination in multi-agent projects
**Research flag:** Standard patterns — prop threading into an existing component; no phase research needed.

### Phase Ordering Rationale

- Server-side pipeline first (Phases 1–3) means the most dangerous failure modes (schema rejection by Vertex AI, corrupt PPTX download) are discovered and fixed before any UI masks them.
- Phase 1 specifically validates Vertex AI structured output compatibility for each schema — this is the single highest-risk unknown and is cheapest to fix before downstream work accumulates.
- Phase 4 UI is built knowing the exact 422 error shape from Phase 2, which is why UI follows API and not the reverse.
- The one-way latch (Pitfall 7) and debounce (Pitfall 6) are Phase 4 concerns and must be implemented from the start, not as follow-up fixes after observing the failure.
- Phase 5 is integration and verification, not new feature work — it surfaces cross-cutting issues that only appear with real multi-agent projects.

### Research Flags

All five phases use standard, well-documented patterns. No phase requires a pre-execution `/gsd:research-phase` run. The research files already contain the exact API patterns and code samples needed for each phase. The one area requiring in-execution verification rather than pre-research:

- **Phase 1 execution:** Validate each Zod schema with a real Gemini call before writing any pptxgenjs builders. If a schema fails Vertex AI structured output validation, flatten it further and re-test before proceeding.
- **Phase 3 execution:** Verify `new Response(buffer)` vs `new Response(new Uint8Array(buffer))` on the installed Node.js version. The PITFALLS.md notes this as a gotcha; check early in Phase 3.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | pptxgenjs 4.0.1 official docs verified; ai@6 migration guide verified; ai@6.0.134 package types read directly from `node_modules/ai/dist/index.d.ts` lines 681–701 |
| Features | HIGH for structure; MEDIUM for thresholds | Slide schemas derived from in-repo agent system prompts. Message count thresholds are pedagogically reasoned starting points — must be calibrated against real student conversations post-launch |
| Architecture | HIGH | Route pattern verified against existing chat route source; `generateText`/`Output.object()` parameter shapes verified from installed package types; data flow derived from existing `UnifiedChatWindow` state shape |
| Pitfalls | MEDIUM-HIGH | Core technical pitfalls verified against official docs and GitHub issues; UX pitfalls (button re-locking, over-firing) are first-principles analysis of the existing codebase rather than external-source findings |

**Overall confidence:** HIGH

### Gaps to Address

- **Message count thresholds discrepancy:** ARCHITECTURE.md uses placeholder values (3 assistant messages per slide type); FEATURES.md provides rationale-backed starting values (e.g., 8 message pairs for Trend Mapper, 10 for Business Model). Use the FEATURES.md values in `thresholds.ts` and expose them as easily-tunable constants. Calibrate against real student conversations after the first live session.

- **`generateText` vs `generateObject` in ARCHITECTURE.md code samples:** ARCHITECTURE.md uses `generateObject` in its example code — this is the deprecated AI SDK v6 API. All implementation code must use `generateText` with `Output.object({ schema })`. Verify the exact import path from `node_modules/ai/` before writing any extraction code.

- **Node.js Buffer compatibility in `new Response()`:** PITFALLS.md flags that passing a Node.js `Buffer` directly to `new Response()` may break on some Node versions. Verify during Phase 3 whether `new Uint8Array(buffer)` is required. Test on the exact Node.js version in use.

---

## Sources

### Primary (HIGH confidence)
- `src/context/system-prompt.txt` (in-repo) — Trend Mapper 6-slide structure, sentence templates
- `src/context/agents/value-designer.txt` (in-repo) — Value Designer Activities 1–6, Activity 6 consolidation outputs
- `.planning/PROJECT.md` (in-repo) — v2.1 requirements and constraints
- `/node_modules/ai/dist/index.d.ts` lines 681–701 (installed package) — `generateText`/`Output.object()` parameter signatures, ai@6.0.134
- [PptxGenJS Quick Start](https://gitbrent.github.io/PptxGenJS/docs/quick-start/) — `new pptxgen()`, `addSlide()`, `addText()`, `writeFile()` API
- [PptxGenJS Saving Presentations](https://gitbrent.github.io/PptxGenJS/docs/usage-saving/) — `write('nodebuffer')` returns `Promise<Buffer>`, browser download behavior
- [PptxGenJS Integration](https://gitbrent.github.io/PptxGenJS/docs/integration/) — Node 18+ requirement, Next.js webpack transpilePackages note
- [AI SDK 6 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) — `generateObject` deprecated; `generateText` + `Output.object()` is current pattern
- [AI SDK Output Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/output) — `Output.object()` parameters, response shape

### Secondary (MEDIUM confidence)
- [PptxGenJS npm page](https://www.npmjs.com/package/pptxgenjs) — v4.0.1 confirmed current stable, zero runtime dependencies
- [Vercel AI SDK generateObject reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object) — deprecated API surface documentation
- [AI SDK NoObjectGeneratedError reference](https://ai-sdk.dev/docs/reference/ai-sdk-errors/ai-no-object-generated-error) — error handling patterns
- [AI SDK GitHub issue #9002](https://github.com/vercel/ai/issues/9002) — generateObject structured output failures
- [AI SDK GitHub issue #7358](https://github.com/vercel/ai/issues/7358) — schema validation failures with nested objects
- [Next.js App Router binary download discussion](https://github.com/vercel/next.js/discussions/51676) — binary response patterns
- [Next.js maxDuration configuration](https://nextjs.org/docs/app/api-reference/file-conventions/route) — route timeout configuration

### Tertiary (LOW confidence / inferred)
- Message count thresholds (8 pairs for Trend Mapper, 10 for Business Model, etc.) — pedagogically reasoned; must be validated against real student conversations post-launch
- UX pitfall analysis (button re-locking, completeness check over-firing) — first-principles analysis of the existing codebase; no external primary source

---
*Research completed: 2026-03-22*
*Supersedes: SUMMARY.md v1.0 (2026-03-21) — prior research covered MVP v1.0 stack and architecture*
*Ready for roadmap: yes*
