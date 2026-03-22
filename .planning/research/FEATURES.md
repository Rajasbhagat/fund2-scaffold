# Feature Research

**Domain:** AI-powered slide generation from multi-agent chat conversations (pedagogical MBA tool)
**Researched:** 2026-03-22
**Confidence:** HIGH for behavioral patterns (derived from authoritative agent specs); MEDIUM for pptxgenjs server-side delivery patterns; MEDIUM for AI SDK structured extraction (API is deprecated/evolving — verify during implementation)

---

## Scope of This Document

This document covers **milestone v2.1 only** — the AI-powered slide generation layer added on top of the existing multi-agent platform (Phases 1–10, which are complete or in progress). Prior MVP v1.0 feature research is preserved as an appendix. The new features are:

1. Progressive disclosure of per-slide "Generate" buttons
2. Two-stage readiness detection (message count heuristic + Gemini completeness check)
3. Structured data extraction from conversation history using `generateObject` / `generateText` with Zod
4. Five slide types rendered to `.pptx` via pptxgenjs
5. File download response from a Next.js API Route Handler

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features MBA students will assume exist once they learn slides can be generated. Missing these = feature feels broken or unfinished.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| "Generate Slide" button visible in conversation view | Students must be able to trigger generation without leaving the chat | LOW | Button per slide type, positioned near or below the chat panel |
| Disabled state with tooltip explaining unlock condition | Standard affordance for locked features; without it students will click a gray button and not understand why nothing happens | LOW | Use `disabled` + `title` or a tooltip; "Keep chatting — this unlocks after sufficient conversation" |
| Button unlocks automatically as conversation progresses | If students must manually click "check readiness," it breaks flow; the unlock should happen silently | MEDIUM | Client polls or triggers check after each agent message; no user action required |
| Generated slide downloads as `.pptx` | Students expect a file they can open in PowerPoint or Google Slides; anything else (HTML, image) would be wrong for this audience | MEDIUM | pptxgenjs on server, served via Content-Disposition: attachment |
| Slide content is derived from conversation, not generic | A blank or generic template would be useless; students expect to see their actual trend/persona/JTBD reflected in the output | HIGH | Structured extraction must map conversation to slide fields accurately |
| Visual feedback while generation is in progress | pptxgenjs + Gemini extraction may take 2–5 seconds; no spinner = user double-clicks or navigates away | LOW | Button shows "Generating…" state; spinner icon during API call |
| Slides that can be opened without errors | Corrupt or empty `.pptx` files destroy trust immediately | MEDIUM | Test every generated file opens in PowerPoint and Google Slides |

---

### Differentiators (Competitive Advantage)

Features specific to this use case that generic AI tools don't offer.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-slide progressive unlocking tied to pedagogical readiness | Students cannot generate a Value Prop slide before they've actually discussed value — the unlock IS the pedagogy; it enforces the course arc | MEDIUM | Two-stage check: count heuristic first (cheap), then Gemini completeness call (expensive) only when count threshold is met |
| Gemini-judged completeness check (not just message count) | Message count alone is a bad proxy — a student can say "yes" 10 times and have no content; Gemini reading the actual conversation is the right signal | MEDIUM | `generateObject` call with a Zod boolean schema: `{ ready: boolean, missingElements: string[] }` |
| `missingElements` array surfaced in tooltip when not ready | Instead of a vague "keep chatting," tell the student exactly what is missing: "Missing: specific persona name, persona occupation, JTBD statement" | LOW (once extraction is built) | Re-uses the completeness check output; high pedagogical value |
| Structured extraction maps to course-specific slide schemas | Each slide type has a schema derived directly from the FUND II spec — not a generic AI summary but fields aligned to what professors expect | HIGH | Five distinct Zod schemas, one per slide type; each schema key maps to a pedagogically meaningful field |
| Trend Mapper slide: 6-part structure from system prompt | The system prompt explicitly defines the 6-slide format — Slide Signal, Evidence, Drivers, Implications, Opportunity Framing, Reflection. The `.pptx` mirrors this exactly | HIGH | Extract per-slide content from conversation, not a single monolith |
| Value Designer slides: 4 distinct types from activity outputs | Each slide (Opportunity, Value Prop, Customer Segment, Business Model) maps to a different activity in the VD facilitation workflow — extracting from the right activity's output is the hard part | HIGH | Prompt engineering: ask Gemini to find content matching "Activity 1 persona", "Activity 3 JTBD", "Activity 6 solution consolidation" etc. |
| No new auth, no DB schema changes | v2.1 slides are stateless — generate on demand, serve immediately; no slide storage required | LOW | Intentional constraint per PROJECT.md; keeps implementation clean |

---

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Storing generated slides in the database | "Save my slide so I can re-download it" | Adds DB schema migration + blob storage complexity; slides are cheap to re-generate on demand since the conversation history is already persisted | Re-generate on demand from the same conversation; no storage needed |
| Single "Generate All Slides" button | Feels convenient | Bypasses the progressive disclosure mechanic entirely, which is the pedagogical point — the unlock sequence IS the learning feedback | Keep per-slide buttons; one per type |
| Slide preview in the browser (HTML render) | "I want to see it before downloading" | pptxgenjs has no browser preview capability; adding an HTML slide renderer is a separate project (Reveal.js, Impress.js) with non-trivial layout fidelity | Show a structured text summary of extracted fields before generation; do not attempt visual preview |
| Editable fields before generation | "Let me fix the extracted text" | Editing UI adds significant frontend complexity; the correct feedback loop is to continue chatting and re-generate | Let Gemini do the extraction; if the output is wrong, the student refines in chat and regenerates — this is faster than a form UI |
| Export to Google Slides directly | API integration seems natural | Google Slides API requires OAuth + service account per user; adds auth complexity explicitly out of scope for v2.1 | Export `.pptx`; Google Slides imports `.pptx` natively with one click |
| Slide templates with images / brand assets | "Make it look professional" | pptxgenjs image embedding requires URL or base64 blobs; introducing images adds layout fragility and content sourcing complexity | Text-only slides with HUD-consistent color tokens (matching app's `hud-accent: #ebff00`, `hud-bg: #d2edea`) — clean and consistent with the app aesthetic |
| Auto-trigger generation when readiness detected | "Why do I still have to click?" | Silently generating a file a student didn't ask for is unexpected behavior; some students may not want a slide from every conversation | Surface readiness via button unlock (active state) + toast notification; require explicit click to generate |
| Message count as the only unlock signal | Simplest implementation | A conversation with 20 one-word replies passes the count check but has no content; Gemini must judge actual completeness | Two-stage: count heuristic gates whether the Gemini check even runs; Gemini check is the authoritative signal |

---

## Feature Dependencies

```
[Persistent chat history per agent] (Phase 3 — complete)
    └──required by──> [Completeness check] (needs conversation to inspect)
                          └──required by──> [Button unlock logic]
                                                └──required by──> [Generate Slide button UI]
                                                                      └──required by──> [Structured extraction API call]
                                                                                            └──required by──> [pptxgenjs slide render]
                                                                                                                  └──required by──> [File download response]

[agentType on Message] (Phase 5 — pending)
    └──required by──> [Agent-specific conversation filtering] (extract only the right agent's messages)
                          └──required by──> [Per-agent slide generators] (Trend Mapper vs. Value Designer)

[Gemini generateObject / generateText with output] (external: AI SDK v6)
    └──powers──> [Completeness check]
    └──powers──> [Structured data extraction]
```

### Dependency Notes

- **Completeness check requires Phase 5 (agentType on Message):** Without `agentType`, the completeness check API cannot filter the conversation to only the relevant agent's messages. The Trend Mapper slide generator should only read Trend Mapper messages; the Value Designer generators should only read Value Designer messages. Phase 5 must land before v2.1 can be implemented correctly.

- **AI SDK v6 / generateObject deprecation:** The existing codebase uses `ai@6.0.134` and `@ai-sdk/google-vertex@4.0.93`. In AI SDK v6, `generateObject` is deprecated in favor of `generateText` with `output: 'object'` and an `outputSchema`. The implementation must use the v6 pattern — do not use `generateObject` directly, as it is deprecated and may be removed. Verify exact API surface in `node_modules/ai/` before writing extraction code.

- **pptxgenjs does not exist in package.json yet:** It must be installed. It is a pure Node.js library with no native dependencies — safe to add.

- **Button unlock state is client-side UI state, not DB state:** The unlock check fires from the client after each agent message arrives (or on conversation load). It calls a lightweight API endpoint that runs the two-stage check server-side. The result is ephemeral client state — no DB write needed.

---

## Progressive Disclosure: When Buttons Unlock

This is the core UX mechanic. The spec mandates two stages:

### Stage 1 — Message Count Heuristic (cheap gate)

Run first; if below threshold, button stays locked without making a Gemini API call.

| Slide Type | Recommended Minimum Message Pairs | Rationale |
|------------|-----------------------------------|-----------|
| Trend Mapper (6-part) | 8 pairs (16 messages) | The system prompt has 6 slides + signal/trend validation steps; a thorough conversation needs at least 8 exchanges |
| VD: Opportunity Statement | 6 pairs | Activity 2 (struggling moments + why now) is the source; needs depth |
| VD: Value Proposition | 8 pairs | Requires Activities 1–4 (persona, problem, JTBD, tasks + desired outcomes) to be substantive |
| VD: Customer Segment | 5 pairs | Primarily from Activity 1 (persona); more focused than others |
| VD: Business Model | 10 pairs | Requires Activity 5 (Digital Density Canvas) to have real content; latest-unlocking slide |

These thresholds are starting points. They should be calibrated after seeing real student conversations — they can be adjusted by changing constants, not by re-architecting.

### Stage 2 — Gemini Completeness Check (authoritative gate)

Only runs when Stage 1 passes. Makes a single non-streaming `generateText` (or `generateObject`) call with the conversation history and a schema like:

```typescript
// Per-slide completeness schema (example for Trend Mapper)
const TrendMapperReadinessSchema = z.object({
  ready: z.boolean(),
  missingElements: z.array(z.string()), // e.g. ["slide 3 drivers not discussed", "no S-curve positioning"]
  confidence: z.enum(["high", "medium", "low"])
})
```

The prompt instructs Gemini to act as a pedagogical reviewer, not a quality judge — the question is "Is enough content present to populate this slide?" not "Is this content good?"

**Output used for:**
- `ready: true` → unlock the Generate button, clear any tooltip
- `ready: false` → keep button locked; populate tooltip with `missingElements` array
- `confidence: "low"` → treat as not ready (conservative)

### Polling / Re-check Trigger

Check should run:
1. On initial conversation load (in case a previous session already met the threshold)
2. After each assistant message arrives (debounced — only run if message count just crossed a heuristic threshold)

Do NOT run Stage 2 on every message — it adds a Gemini call per message, which burns tokens and adds latency. Gate it carefully behind Stage 1.

---

## Structured Data Extraction: Inputs and Schema

### What Goes Into the Extraction Prompt

The extraction call is separate from the completeness check. It uses the full conversation history (filtered to the relevant agent's messages) as context, with a system instruction like:

```
You are extracting structured slide content from a student's conversation with the FUND II [Agent Name].
Extract only what was explicitly discussed and agreed upon in the conversation.
If a field is not present in the conversation, return null for that field — do not invent content.
```

### Slide Schemas (Zod — 5 types)

**Slide 1: Trend Mapper (6-part)**
```typescript
z.object({
  trendSignal: z.string().nullable(),      // "We observe a growing shift in ___, where ___"
  evidence: z.string().nullable(),          // Data points, citations from the conversation
  driversOfChange: z.string().nullable(),   // Tech/policy/behavior drivers discussed
  emergingImplications: z.string().nullable(), // "If this continues, we may see..."
  opportunityFraming: z.string().nullable(), // "How might we help [user] do [task] given [trend]?"
  finalReflection: z.string().nullable()   // Student's reflection / "I'd be excited because..."
})
```

**Slide 2: Opportunity Statement (Value Designer, Activity 2)**
```typescript
z.object({
  persona: z.string().nullable(),           // Brief persona reference (name + role)
  strugglingMoment: z.string().nullable(),  // Primary struggling moment identified
  whyNow: z.string().nullable(),            // The "why now" trigger linked to the trend
  jobToBeDone: z.string().nullable()        // JTBD statement if Activity 3 was reached
})
```

**Slide 3: Value Proposition (Value Designer, Activities 3–5)**
```typescript
z.object({
  jtbd: z.string().nullable(),              // Full WHEN/I WANT TO/SO I CAN statement
  keyTasks: z.array(z.string()).nullable(), // Approved key tasks from Activity 4
  desiredOutcomes: z.array(z.string()).nullable(), // ODI-format outcomes
  digitalDensityHighlights: z.string().nullable()  // Key digital density choices from Activity 5
})
```

**Slide 4: Customer Segment (Value Designer, Activity 1)**
```typescript
z.object({
  personaName: z.string().nullable(),
  ageLifeStage: z.string().nullable(),
  locationContext: z.string().nullable(),
  occupationRole: z.string().nullable(),
  industryEnvironment: z.string().nullable(),
  keyValues: z.array(z.string()).nullable(),
  attitudeTowardTechnology: z.string().nullable(),
  lifeAreas: z.array(z.string()).nullable() // Primary/secondary life areas from Activity 1.5
})
```

**Slide 5: Business Model (Value Designer, Activity 5–6)**
```typescript
z.object({
  companyName: z.string().nullable(),       // From Activity 6 Step 1
  slogan: z.string().nullable(),            // From Activity 6 Step 3
  solutionSummary: z.string().nullable(),   // From Activity 6 Step 4 coherence summary
  keyActors: z.array(z.string()).nullable(), // From Activity 5 Step 2 actors mapping
  sixUserBenefits: z.array(z.string()).nullable() // The 6 concrete benefits from Activity 6 Step 4
})
```

**Null handling rule:** Any field returned as `null` renders as a placeholder in the slide: `"[Not yet defined — continue the conversation]"`. This is preferable to extraction errors or hallucinated content.

---

## Slide Template Design (pptxgenjs)

### General Layout Principles

- Use the app's HUD design tokens: `#d2edea` (bg), `#1a2024` (text), `#ebff00` (accent), `#b1dbd8` (panel fill) — consistency with the Aerospace HUD UI
- Widescreen format: 10in x 5.625in (16:9)
- No images, no rounded corners, no shadows — flat brutalist aesthetic matching the HUD system
- Title area: neon yellow background block (`#ebff00`) with dark text — mirrors `HUDAccentBlock`
- Body area: pale icy-blue background (`#d2edea`) with slate text (`#1a2024`)
- Section labels in `JetBrains Mono` equivalent (closest pptxgenjs font: `Courier New`) — monospace for field labels
- Body text in `Rajdhani` equivalent (closest: `Calibri` or `Arial`) for legibility in PowerPoint

### Slide 1: Trend Mapper (6-Part Structure)

Layout: Title block + 6 labeled sections, 2-column grid (3 sections per column)

```
[TREND MAPPER — [Project Name]]          ← HUD accent strip, full width
[TREND SIGNAL]  [We observe a...]        ← Section label (mono) + content
[EVIDENCE]      [This trend is...]
[DRIVERS]       [This shift is driven by...]
---
[IMPLICATIONS]  [If this continues...]
[OPPORTUNITY]   [How might we help...]
[REFLECTION]    [This made me wonder...]
```

### Slides 2–5: Value Designer

Each slide uses a consistent structure:
- Full-width HUD accent strip header with slide title
- Left column: field labels in monospace uppercase
- Right column: extracted content in regular weight

**Slide 2: Opportunity Statement** — 4 rows (Persona, Struggling Moment, Why Now, JTBD)
**Slide 3: Value Proposition** — JTBD statement full-width, then Key Tasks + Desired Outcomes as paired rows, Digital Density summary
**Slide 4: Customer Segment** — 8 rows matching the 10-element persona format (condensed: combine some fields)
**Slide 5: Business Model** — Company + Slogan in header block, Key Actors + 6 Benefits in two columns

---

## MVP Definition

### Launch With (v2.1 — this milestone)

- [ ] **Message count heuristic** — constant thresholds per slide type, evaluated client-side after each message
- [ ] **Gemini completeness check** — single `generateText` (output schema) call, server-side, triggered only after count threshold
- [ ] **Button states** — locked (disabled, tooltip with missing elements), ready (active, accent color), generating (spinner)
- [ ] **Trend Mapper slide extraction** — Zod schema, `generateText` with output, 6 fields
- [ ] **4 Value Designer slide extractions** — Zod schemas, same API pattern, null-safe
- [ ] **pptxgenjs rendering** — 5 template functions, HUD color tokens, widescreen 16:9
- [ ] **File download API route** — `/api/slides/[projectId]/[slideType]` POST → returns `application/vnd.openxmlformats-officedocument.presentationml.presentation` with `Content-Disposition: attachment`
- [ ] **No DB changes** — stateless generation; conversation history already persisted

### Add After Validation (v1.x)

- [ ] **Threshold calibration** — after seeing real student conversations, tune message count thresholds; add feature flag to override per-agent
- [ ] **Retry on null fields** — if extraction returns more than 2 null fields, prompt Gemini a second time with targeted follow-up questions surfaced to the student
- [ ] **Generation history toast** — show "Trend Mapper slide generated at 14:32" as a non-intrusive notification so student knows it was generated without downloading again immediately

### Future Consideration (v2+)

- [ ] **Slide storage + re-download** — store generated `.pptx` bytes in DB or filesystem; allow re-download without re-generation (add only when students complain about generation time)
- [ ] **Google Slides export** — OAuth complexity pushes this to v3 when auth is introduced anyway
- [ ] **HTML slide preview** — requires a full slide renderer (Reveal.js or similar); significant effort for a "nice to have"
- [ ] **Editable field form** — pre-populate extracted fields in a form before generating; deferred because re-chat is simpler

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Button unlock via message count | HIGH | LOW | P1 |
| Gemini completeness check | HIGH | MEDIUM | P1 |
| Missing elements tooltip | HIGH | LOW (depends on completeness check) | P1 |
| Trend Mapper extraction + pptx | HIGH | MEDIUM | P1 |
| Customer Segment extraction + pptx | HIGH | MEDIUM | P1 |
| Value Proposition extraction + pptx | HIGH | HIGH | P1 |
| Opportunity Statement extraction + pptx | MEDIUM | MEDIUM | P1 |
| Business Model extraction + pptx | MEDIUM | HIGH | P1 |
| HUD-themed slide styling | MEDIUM | LOW | P2 |
| Generation toast notification | LOW | LOW | P2 |
| Slide storage + re-download | LOW | MEDIUM | P3 |
| HTML slide preview | LOW | HIGH | P3 |
| Editable fields before generation | MEDIUM | HIGH | P3 |

**Priority key:**
- P1: Must have for v2.1 launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Existing Feature Appendix (MVP v1.0 — complete)

The following were the table stakes for the original MVP. All are built and validated.

| Feature | Status |
|---------|--------|
| Project CRUD (create, rename, delete, open) | Complete |
| Persistent chat history per project | Complete |
| Streaming Vertex AI responses | Complete |
| System prompt + megatrend context injection | Complete |
| Rolling window for token budget | Complete |
| Markdown rendering | Complete |
| Loading + error states | Complete |
| Responsive layout | Complete |

The slide generation milestone adds on top of this foundation. No existing features are modified or removed.

---

## Sources

- `src/context/system-prompt.txt` — Trend Mapper 6-slide structure (Slides 1–6 sentence templates) — HIGH confidence
- `src/context/agents/value-designer.txt` — VD Activities 1–6 structure, Activity 6 consolidation outputs — HIGH confidence
- `.planning/PROJECT.md` — v2.1 requirements and constraints — HIGH confidence
- [AI SDK Core: generateObject](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object) — `generateObject` deprecated; use `generateText` with `output` in AI SDK v6 — MEDIUM confidence (verify in `node_modules/ai/` during implementation)
- [AI SDK 6 - Vercel](https://vercel.com/blog/ai-sdk-6) — v6 unified API for structured output — MEDIUM confidence
- [PptxGenJS Home](https://gitbrent.github.io/PptxGenJS/) — server-side Node.js generation, zero runtime dependencies — MEDIUM confidence (verify pptxgenjs version compatibility with Node.js 20 during implementation)
- [PptxGenJS Integration](https://gitbrent.github.io/PptxGenJS/docs/integration/) — serverless/API route support confirmed — MEDIUM confidence
- Progressive disclosure pattern rationale: [NN/G Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/), [AI UX Design Patterns](https://www.aiuxdesign.guide/patterns/progressive-disclosure) — HIGH confidence for behavioral pattern; LOW confidence that these specific thresholds are optimal

---
*Feature research for: AI-powered slide generation from chat conversations (FUND II v2.1)*
*Researched: 2026-03-22*
*Supersedes: prior FEATURES.md (MVP v1.0 feature set, dated 2026-03-21) — v1.0 features preserved in appendix*
