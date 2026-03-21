# Feature Landscape

**Domain:** Multi-project AI chat web app (pedagogical / single-workspace)
**Researched:** 2026-03-21
**Confidence:** HIGH (agent spec is fully defined; feature set derived from system prompt + constraints + known patterns from ChatGPT Projects / Claude Projects / Perplexity Spaces)

---

## Reference Products Analyzed

- **ChatGPT Projects** — per-project memory, file uploads, named projects, sidebar navigation
- **Claude Projects** — per-project context docs, named conversations, project-level instructions
- **Perplexity Spaces** — topic-focused workspaces, shared context, multiple threads per space
- **FUND II Trend Mapper spec** — strict pedagogical agent with a 6-slide workflow, two operating modes, and megatrend knowledge base

---

## Table Stakes

Features users expect. Missing = app feels broken or incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Create a new project with a name | Core premise — students work on different trends per project | Low | Minimal form: name field + create button |
| Project list / dashboard | Without it users can't find previous work | Low | List or card grid; sorted by recency |
| Open a project and land in its chat | Navigation between project list and chat must be seamless | Low | Click project → chat view |
| Persistent chat history per project | If messages disappear on refresh the tool is useless | Medium | SQLite + Prisma; load on open, append on send |
| Send a message and receive a streaming AI response | Core interaction; non-streaming feels sluggish by comparison | Medium | Vertex AI Gemini streaming; SSE or ReadableStream |
| Agent responds with the correct Trend Mapper persona | Agent must match the FUND II system prompt exactly — wrong behavior = broken pedagogy | Medium | System prompt injected per request; megatrend docs injected as context |
| Rename a project | Students pick tentative trend names that change | Low | Inline edit or modal |
| Delete a project | Students create test projects or abandoned directions | Low | Confirm dialog + cascade delete chat history |
| Markdown rendering in chat | Agent responses use headers, bold, bullet lists heavily | Low | react-markdown or similar; already expected in any AI chat |
| Loading / thinking indicator | Without it users spam-submit thinking the request was lost | Low | Spinner or animated dots while streaming |
| Error state handling | Vertex AI will occasionally fail; silent failures confuse users | Low | Toast or inline error message with retry affordance |
| Responsive layout | Students use laptops in class and at home | Low | Sidebar + main panel; collapses cleanly on smaller screens |

---

## Differentiators

Features that are specific to the FUND II use case. Not expected in generic AI chat apps, but central to this product's value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Megatrend knowledge base injected as context | Agent gives responses grounded in three research docs (Impact Impulse Matrix, Great Fragmentation, Deep Research Report); without this the agent lacks the domain knowledge the spec assumes | Medium | Extract text from .docx/.pdf at build time; inject as system context alongside system prompt |
| Web search grounding via Vertex AI | Agent spec mandates citing real data sources; without it the agent violates its own guardrail ("NEVER invent statistics") | Medium | Enabled via Vertex AI Grounding config — not a custom pipeline |
| Strict system prompt fidelity | The pedagogical behavior (challenge-first, scaffold-don't-solve, pre-class vs. in-class modes, terminology discipline) is the core product differentiation vs. asking ChatGPT directly | Low (config) / High (testing) | Must test that guardrails hold: no full slide decks produced, no pain-point language, no logistics answers |
| Challenge-first opening pattern | First agent response to a trend proposal should pressure-test it, not validate it — distinctive from typical assistants that default to agreement | N/A (agent behavior) | Emerges from system prompt; no extra engineering required |
| Pre-class vs. in-class mode awareness | Agent adapts its depth based on contextual signals (assignment mode vs. in-session analysis) | N/A (agent behavior) | Handled by system prompt; no UI toggle needed for MVP |
| Session 3 bridge language | Agent plants seeds for the next course session when trend analysis is complete — connects the tool to the broader course arc | N/A (agent behavior) | Handled by system prompt |
| Project names tied to trend topics | Unlike generic "New Chat," project names ARE the trend being explored — naming is semantically meaningful | Low | Default new project name: "Untitled Trend" with immediate rename prompt |

---

## Anti-Features

Features to explicitly NOT build for MVP, with rationale.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| User authentication / login | Doubles scope; OAuth or credential management is a project in itself; students share a single URL | Single shared workspace; all projects visible to everyone who has the URL |
| Per-user project isolation | Requires auth to implement correctly; without auth, isolation is fake security | Accept shared workspace; name projects clearly |
| PDF / slide export | Tempting but out of scope; adds document generation complexity; students copy/paste to their slide tool | Let students copy text from chat; note this as Phase 2 |
| Real-time collaboration / multiplayer | Different from chat persistence; would require WebSockets, operational transforms, and conflict resolution | Single user per project; no concurrent editing |
| Vector database / RAG over megatrend docs | Overengineered for MVP; docs are finite (~3 documents, manageable token count) | Inject full extracted text as system context |
| Custom web search pipeline | Vertex AI Grounding handles this natively; reimplementing it adds infra complexity with no benefit | Use Vertex AI Grounding config |
| Multiple agents / agent switching | Other FUND II co-pilots (Value Designer, Course Butler) are out of scope | Hard-code Trend Mapper agent only |
| Chat branching / conversation forks | Adds UI complexity; linear chat is the correct mental model for a guided workflow | Linear message thread per project |
| Conversation search / filtering | Useful but not needed at the student scale (5-30 projects max per cohort) | Phase 2 if user numbers grow |
| Image or file upload from user | Agent spec does not use student-uploaded files; megatrend docs are pre-loaded | No upload UI |
| Light/dark mode toggle | Nice-to-have; adds CSS complexity for zero pedagogical value | Ship one theme; dark mode can be Phase 2 |
| Undo / edit sent messages | Adds state management complexity; students can just continue the conversation | No message editing |
| Project archiving / tagging | Too few projects to warrant organization features | Simple list sorted by last updated |
| Agent configuration UI | System prompt must match the spec exactly; a config UI invites drift | Hard-code system prompt; configuration is dev-only |

---

## Feature Dependencies

```
Project CRUD (create, rename, delete)
  └─> Project list / dashboard
      └─> Open project → chat view
          └─> Persistent chat history (load on open)
              └─> Send message → streaming AI response
                  └─> System prompt + megatrend docs injected at request time
                      └─> Vertex AI Grounding (web search) enabled
                          └─> Markdown rendering of response
                          └─> Loading / error states
```

Megatrend doc extraction (build-time) must complete before any Vertex AI request works correctly. This is a prerequisite for the agent behaving as specified.

---

## MVP Recommendation

### Must ship (Phase 1 target)

1. **Project dashboard** — create, list, rename, delete projects
2. **Persistent chat per project** — load history on open, append on send, survive page refresh
3. **Streaming AI response** — Vertex AI Gemini with system prompt + megatrend context + web search grounding
4. **Markdown rendering** — headers, bold, bullets in chat bubbles
5. **Loading + error states** — thinking indicator, error toast with retry

### Can ship in Phase 2

- PDF / slide export (copy-paste is sufficient for MVP)
- Dark mode
- Conversation search
- Auth + per-user isolation (when cohort size or privacy requires it)

### Do not ship without explicit product decision

- Any agent other than Trend Mapper
- User accounts or login
- File upload from students

---

## Complexity Summary

| Complexity | Features |
|------------|----------|
| Low | Project CRUD UI, dashboard, navigation, error states, loading indicator, markdown rendering, rename/delete |
| Medium | Streaming response pipeline (Vertex AI + SSE), chat persistence (SQLite + Prisma), megatrend doc extraction and injection |
| High (testing, not engineering) | System prompt fidelity verification — ensuring guardrails hold, correct mode switching, no hallucinated data |

---

## Sources

- FUND II Trend Mapper System Prompt (`/Trend Mapper/FUND_II_Trend_Mapper_System_Prompt.txt`) — HIGH confidence, authoritative spec
- PROJECT.md (`/.planning/PROJECT.md`) — HIGH confidence, validated requirements
- ChatGPT Projects, Claude Projects, Perplexity Spaces feature sets — MEDIUM confidence (derived from training data; core feature patterns are stable across 2024-2026)
- Vertex AI Grounding capabilities — MEDIUM confidence (training data + known Vertex AI product capability; verify exact API config during implementation phase)
