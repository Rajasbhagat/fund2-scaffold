# Phase 6 Research: Value Designer & SPI Agents

**Phase:** 06-value-designer-spi
**Created:** 2026-03-21
**Purpose:** Document findings from reading both agent spec files and the codebase to inform Phase 6 implementation.

---

## 1. Agent Spec Findings

### 1.1 Value Designer (VD)

**Source files:**
- `Value Designer/FUND_II_Value_Designer_Agent_Spec.txt` — v1.0, February 2026
- `Value Designer/FUND_II_Value_Designer_JTBD_Integration_Update.txt` — v1.1, 21 February 2026

**What VD is:**
A structured facilitation engine for FUND II Sessions 3–4 ("New Value Proposition"). NOT a research tool — no web search. All inputs come from the student team.

**Operating modes:**
- IN-SESSION MODE: Guided workflow through Activities 1–6 with mandatory confirmation gates. Sequential — never skips.
- POST-SESSION MODE: Structured draft generation once Activities 1–6 are complete.

**The 6 Activities:**
1. Trend / Problem & User Persona (10-dimension persona, Life Areas bridging from JTBD TN)
2. Problem Deep Dive (struggling moments, four forces, 3-dimension impact)
3. Job to Be Done (WHEN/I WANT TO/SO I CAN format + Action+Object+Context shorthand; validation checklist)
4. Key Tasks & Desired Outcomes (ODI: Direction + Performance Metric + Object)
5. Digital Density Canvas (Automation, Anticipation, Coordination, Personalization + Actors/Data/Connections)
6. Solution Consolidation (company name, logo concept, slogan, 6 user benefits, self-assessment, bridge to Sessions 5–6)

**Post-Session draft sections:**
Problem Statement, Target Segment, Industry Trends, Competitor Landscape, Market Sizing (TAM/SAM/SOM)

**Key design constraints hardcoded in spec:**
- Web Search: DISABLED — facilitation engine, not research tool
- Temperature: 0.3–0.5 (lower than Trend Mapper)
- Language: English only
- Never grades; never skips activity gates; always proposes first, team iterates
- Mandatory Miro board reminders at each activity gate

**JTBD Integration Update (v1.1) key additions:**
- Life Areas framework inserted before persona construction (Health & Wellbeing, Work & Productivity, Money & Finance, Home & Living, Mobility & Transport, Food & Consumption, Relationships, Learning & Growth, Entertainment)
- Struggling Moments + Four Forces replaces generic "pain points" framing in Activity 2
- Full WHEN/I WANT TO/SO I CAN format replaces Action+Object+Context as primary in Activity 3
- Validation checklist (8 criteria) added to Activity 3
- Three-dimensional JTBD (functional/emotional/social) more explicit throughout
- Post-session draft explicitly maps JTBD to all three dimensions and adds JTBD TN's "value proposition first" closing reminder

**Combined system prompt structure (as extracted for context file):**
The spec text between `=== BEGIN SYSTEM PROMPT ===` (line 231) and `=== END SYSTEM PROMPT ===` (line 667) is the base system prompt. The JTBD Integration Update document (v1.1) provides modifications to sections [IDENTITY], [ACTIVITY 1], [ACTIVITY 2], [ACTIVITY 3], and [POST-SESSION MODE]. These must be merged to produce the final `value-designer.txt`.

**System prompt section markers (for construction):**
- `[IDENTITY]`
- `[GENERAL RULES]`
- `[CONTEXT INTAKE]`
- `[ACTIVITY 1 — TREND / PROBLEM & USER PERSONA]`
- `[ACTIVITY 2 — PROBLEM DEEP DIVE]`
- `[ACTIVITY 3 — JOB TO BE DONE (JTBD)]`
- `[ACTIVITY 4 — KEY TASKS & DESIRED OUTCOMES]`
- `[ACTIVITY 5 — DIGITAL DENSITY CANVAS]`
- `[ACTIVITY 6 — SOLUTION CONSOLIDATION]`
- `[POST-SESSION MODE — ASSIGNMENT DRAFT GENERATION]`
- `[GUARDRAILS]`
- `[OPENING GREETING]`

**Session injection point:**
`[Current FUND II Session: N of 10]` appended to system prompt — same pattern as Trend Mapper.

---

### 1.2 SPI (Synthetic Persona Interviewer)

**Source file:** `SPI - Sythetic Persona Interviewer/SPI_Agent_Spec_v1_1.txt` — v1.0, March 2026

**What SPI is:**
A persona generator + sustained in-character interviewer. Produces psychologically realistic Customer, Investor, or Partner personas and interviews them on behalf of student teams. Primary use: Sessions 7–8 but available any time.

**Critical design principle:** Generates REAL answers, not expected ones. Discomfort is the point.

**Three persona archetypes:**
- Customer: end user/buyer. Surfaces workarounds, priorities, willingness-to-act threshold.
- Investor: early-stage capital provider. Pattern-matching against fundability criteria. Never just encouraging.
- Partner: strategic collaborator. Surfaces go-to-market naivety, leverage imbalances, procurement complexity.

**Input tiers:**
- Tier 1 (required): persona type, venture concept, key assumption to test
- Tier 2 (recommended): Miro persona canvas, JTBD statement, value hypothesis, MVP description, specific worries
- Tier 3 (optional): competitive landscape, emotional state modifier, interview goal, geography/culture

**Persona generation output format:**
```
------- PERSONA PROFILE -------
NAME:
ROLE:
CONTEXT:
CURRENT SITUATION:
WHAT THEY CARE ABOUT MOST TODAY:
CURRENT WORKAROUND:
HIDDEN TRUTH:
EMOTIONAL STATE RIGHT NOW:
------- END PROFILE -------
```

**In-character rules (Sections D, non-negotiable):**
- Rule 1: Never break character during interview
- Rule 2: Never give expected answers; react to leading questions
- Rule 3: USE the Hidden Truth at a natural moment
- Rule 4: React to question quality (Mom Test vs. leading)
- Rule 5: Let the interview be uncomfortable
- Rule 6: Maintain emotional continuity throughout
- Rule 7: Calibrate to course stage (Sessions 3-4 constructive; Sessions 9+ full grilling)
- Rule 8: END INTERVIEW triggers debrief mode immediately

**Post-interview debrief structure (Section E):**
1. WHAT THIS PERSONA REVEALED (3–5 key insights)
2. YOUR BEST QUESTIONS (what worked and why)
3. YOUR WEAKEST QUESTIONS (what was leading/hypothetical + Mom Test reframe)
4. ASSUMPTIONS STILL UNTESTED (what to validate next and with which persona type)
5. SUGGESTED NEXT STEP (specific action connecting to course arc)

**System prompt structure (Sections A–E):**
- Section A: Identity & Core Mandate — do not modify
- Section B: Intake Protocol
- Section C: Persona Generation Protocol
- Section D: In-Character Behaviour Rules
- Section E: Post-Interview Debrief Protocol

**Key constraints hardcoded in spec:**
- Web Search: NOT mentioned (implicitly not needed — all context from student input per spec design)
- No teaching mid-interview; no validation; no scripts
- "END INTERVIEW" is the magic phrase that exits character

---

## 2. Codebase Findings

### 2.1 Current Route Handler Pattern (Trend Mapper)

From `src/app/api/chat/[projectId]/route.ts`:

```typescript
export const runtime = 'nodejs';  // REQUIRED for Vertex AI

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
});

const FIRST_KEEP = 4;   // first 2 turns
const LAST_KEEP = 40;   // last 20 turns
const MAX_MESSAGES = FIRST_KEEP + LAST_KEEP;
```

POST body now (after Phase 5 Plan 05-03):
```typescript
const {
  messages: incomingMessages,
  agentType = 'trend-mapper',
  currentSession = 1,
  deepResearch = false,
} = await request.json();
```

DB operations (after Phase 5 Plan 05-01):
```typescript
// Load history (filtered by agentType):
const dbMessages = await prisma.message.findMany({
  where: { projectId, agentType },
  orderBy: { createdAt: 'asc' },
});

// Persist user message:
await prisma.message.create({
  data: { projectId, agentType, role: 'user', content: userMessageContent },
});

// Persist assistant message (onFinish):
await prisma.message.create({
  data: { projectId, agentType, role: 'model', content: event.text },
});
```

Session injection (after Phase 5 Plan 05-03):
```typescript
const systemWithSession = `${systemContext}\n\n[Current FUND II Session: ${currentSession} of 10]`
```

Streaming pattern:
```typescript
const result = streamText({ model, system, tools, messages, onFinish })
const response = result.toTextStreamResponse()
// + headers: X-Accel-Buffering: no, Cache-Control: no-cache, X-Content-Type-Options: nosniff
return new Response(response.body, { status: response.status, headers })
```

### 2.2 Context Loader Pattern (src/lib/context.ts)

```typescript
import 'server-only';
import fs from 'fs';
import path from 'path';

export function getSystemContext(): string {
  const contextDir = path.join(process.cwd(), 'src', 'context');
  const systemPrompt = fs.readFileSync(path.join(contextDir, 'system-prompt.txt'), 'utf-8');
  const megatrendDocs = [1, 2, 3, 4].map((n) =>
    fs.readFileSync(path.join(contextDir, `megatrend-${n}.txt`), 'utf-8')
  );
  return [systemPrompt, ...megatrendDocs].join('\n\n---KNOWLEDGE BASE DOCUMENT---\n\n');
}
```

VD and SPI do NOT need megatrend docs — they are facilitation engines with no external knowledge base. The new loaders are simpler: just read a single `.txt` file and return it.

### 2.3 ChatWindow Routing (after Phase 5 Plan 05-03)

From `src/components/ChatWindow.tsx` (post-Phase-5):
```typescript
interface ChatWindowProps {
  projectId: string
  agentType: string
  initialMessages: Message[]
  currentSession: number
  showDeepResearch: boolean
}

// Currently routes ALL agents to:
const res = await fetch(`/api/chat/${projectId}`, {
  method: 'POST',
  body: JSON.stringify({ messages: [...], agentType, currentSession, deepResearch }),
})
```

Phase 6 Plan 06-03 must update this to route to agent-specific endpoints.

### 2.4 Prisma Schema (current state after Phase 5)

```prisma
model Message {
  id        String   @id @default(cuid())
  projectId String
  agentType String   @default("trend-mapper")
  role      String
  content   String
  createdAt DateTime @default(now())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
  @@index([projectId, agentType, createdAt])
}

model AppSettings {
  id            Int @id @default(1)
  sessionNumber Int @default(1)
}
```

No DB changes needed for Phase 6 — `agentType` already exists.

### 2.5 AgentWorkspace + ChatWindow showDeepResearch (after Phase 5 Plan 05-03)

From `src/components/AgentWorkspace.tsx` (post-Phase-5):
```typescript
<ChatWindow
  projectId={projectId}
  agentType={agent}
  initialMessages={initialMessagesByAgent[agent] ?? []}
  currentSession={sessionNumber}
  showDeepResearch={agent === 'trend-mapper'}
/>
```

Phase 6 requires `showDeepResearch` to remain false for VD and SPI. The existing condition `agent === 'trend-mapper'` already handles this — no change to AgentWorkspace needed for the hide behavior.

Phase 6 DOES need a disabled/grayed-out state for the toggle on VD/SPI vs. just hidden. Per the roadmap success criteria for Phase 6: "disabled (grayed out with tooltip: 'Deep Research is not available for this agent')". The spec says `showDeepResearch=false` already handles hidden. The FARO disabled-grayed state is prep for Phase 7. This means Phase 6 needs to add a `showDeepResearch` variant or a new prop.

**Decision:** Phase 6 Plan 06-03 will add a `disableDeepResearch` prop to ChatInput that shows the toggle but grayed out with a tooltip, controlled by the agent type. For VD and SPI: hidden (showDeepResearch=false remains). For FARO: will be added in Phase 7. The roadmap note says "for FARO add a grayed-out disabled state for future" — we'll add the prop now but only activate it conditionally so Phase 7 can wire it in.

---

## 3. Token Budget Assessment

**VD system prompt:** The base spec text between BEGIN/END SYSTEM PROMPT markers spans approximately lines 231–667 in the Agent Spec (approximately 436 lines of the .txt file). The JTBD Integration Update adds approximately 300 lines of modifications. Combined, the merged prompt will be large — estimate ~8,000–12,000 tokens.

**SPI system prompt:** Sections A–E span approximately lines 393–700+ in the spec file. Estimate ~5,000–8,000 tokens.

Both are within Gemini 2.5 Flash's context window. Token counting should be done during Plan 06-01 execution using the `countTokens` endpoint (same pattern used in Phase 1 for megatrend docs).

No summarization expected to be needed (VD and SPI prompts are substantially smaller than the megatrend docs which were verified in Phase 1).

---

## 4. Implementation Architecture

### Route Handler Design (Plans 06-02 and 06-03)

Each agent gets its own route handler under a distinct URL path:

```
/api/chat/[projectId]               ← Trend Mapper (existing, Phase 5 updated)
/api/chat/value-designer/[projectId] ← Value Designer (Plan 06-02)
/api/chat/spi/[projectId]            ← SPI (Plan 06-03)
/api/chat/faro/[projectId]           ← FARO (Phase 7, placeholder)
```

**Why separate route handlers instead of a single generic one:**
- Each agent has different system prompts, different tool configurations, different behavior
- No tools (no googleSearch) for VD and SPI — must NOT include tools param at all (passing `tools: {}` may cause API errors)
- Separation makes each handler independently readable and testable
- Trend Mapper route handler stays clean/unchanged

### ChatWindow Endpoint Routing (Plan 06-03)

```typescript
function getEndpoint(agentType: string, projectId: string): string {
  switch (agentType) {
    case 'value-designer': return `/api/chat/value-designer/${projectId}`
    case 'spi':            return `/api/chat/spi/${projectId}`
    case 'faro':           return `/api/chat/faro/${projectId}`
    default:               return `/api/chat/${projectId}`
  }
}
```

### No-Tools Pattern

For VD and SPI route handlers, omit the `tools` parameter entirely from `streamText`:

```typescript
const result = streamText({
  model: vertex('gemini-2.5-flash'),
  system: systemWithSession,
  // NO tools property — VD and SPI are facilitation engines, not research tools
  messages: [ ...historyMessages, { role: 'user', content: userMessageContent } ],
  onFinish: async (event) => { /* persist */ },
})
```

### Context File Location

Agent context files will live in `src/context/agents/`:
- `src/context/agents/value-designer.txt`
- `src/context/agents/spi.txt`

This is a new subdirectory. The `getValueDesignerContext()` and `getSPIContext()` loaders in `src/lib/context.ts` will read from this path.

---

## 5. Key Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| VD + JTBD TN spec merge creates inconsistencies | Plan 06-01 explicitly describes merge order and which v1.1 sections override v1.0 sections |
| `tools: {}` empty object causing Vertex AI SDK errors | Omit `tools` key entirely from streamText call (not `tools: {}`) |
| ChatWindow routing breaks existing Trend Mapper | Default case in switch falls through to original `/api/chat/${projectId}` URL |
| Phase 5 not yet complete when Phase 6 runs | Plans 06-02 and 06-03 include explicit `read_first` instructions for Phase 5 output files |
| Token count exceeds context budget | Plan 06-01 includes token measurement step; if exceeded, truncate Knowledge Base sections from spec (those reference external docs not available in our system anyway) |

---

## 6. File Inventory for Phase 6

**New files:**
- `src/context/agents/value-designer.txt` — merged VD system prompt
- `src/context/agents/spi.txt` — SPI system prompt (Sections A–E)
- `src/app/api/chat/value-designer/[projectId]/route.ts` — VD route handler
- `src/app/api/chat/spi/[projectId]/route.ts` — SPI route handler

**Modified files:**
- `src/lib/context.ts` — add `getValueDesignerContext()` and `getSPIContext()` exports
- `src/components/ChatWindow.tsx` — add endpoint routing based on agentType

**Unchanged files:**
- `prisma/schema.prisma` — agentType already exists, no migration needed
- `src/app/api/chat/[projectId]/route.ts` — Trend Mapper route stays as-is
- `src/components/AgentWorkspace.tsx` — showDeepResearch logic already correct
