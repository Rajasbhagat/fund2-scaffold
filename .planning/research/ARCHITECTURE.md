# Architecture Research

**Domain:** Slide Generation Integration — Next.js 16.2.1 multi-agent chat app (v2.1 milestone)
**Researched:** 2026-03-22
**Confidence:** HIGH — verified against installed ai@6.0.134 package types (`dist/index.d.ts` lines 681–701), pptxgenjs 4.0.1 official docs, existing route handler source (`app/api/chat/[projectId]/route.ts`), existing client component source (`src/components/UnifiedChatWindow.tsx`)

---

## Integration Context

This is a subsequent-milestone addition. The existing system is working: Next.js 16.2.1 App Router, route handlers at `app/api/chat/[agentType]/[projectId]/route.ts`, `ai@6.0.134` `streamText` pipeline, Prisma 7 + SQLite, and `UnifiedChatWindow` holding full message history in React state. No existing files are deleted. The integration adds one new API route family and one new client-side state concern.

**Constraint from PROJECT.md:** No DB schema changes for this milestone.

---

## Decision 1: Where the generateObject Call Lives

**Answer: New dedicated route — `app/api/slides/[type]/[projectId]/route.ts`**

Do not add `generateObject` to the existing chat routes. Reasons:

1. The chat routes commit to `text/event-stream` streaming immediately via `streamText`. `generateObject` is blocking and returns structured JSON — it cannot share a response stream with SSE tokens.
2. Slide generation is triggered by a button click, not a chat submission. Coupling it to the chat POST would require a flag parameter and conditional branching that splits route responsibility.
3. The slide route needs binary response headers (`Content-Type: application/vnd.openxmlformats-officedocument.presentationml.presentation`, `Content-Disposition: attachment`). These cannot co-exist with SSE headers in the same handler.
4. Five slide types (Trend Mapper + 4 Value Designer) map cleanly to a `[type]` path segment, matching the existing `[agentType]` convention.

The new route family:

```
app/api/slides/
  [type]/
    [projectId]/
      route.ts     POST: readiness check + generateObject + pptxgenjs + buffer response
```

The `[type]` values mirror the existing agent naming convention:
`trend-mapper`, `opportunity`, `value-prop`, `customer-segment`, `business-model`

---

## Decision 2: Passing Conversation History to the Generation Endpoint

**Answer: Client sends the full messages array in the POST body — same pattern as the unified chat route.**

`UnifiedChatWindow` already maintains the full messages array in React state and sends it on every chat POST. The slide route uses the same contract, which is already established and working.

Request body schema:

```typescript
{
  messages: Array<{ role: string; content: string; agentType?: string | null }>;
  // No currentSession or deepResearch — generation is stateless
}
```

The route handler filters messages to agent-relevant turns before passing to `generateObject`. For a `trend-mapper` slide:

```typescript
const agentMessages = body.messages.filter(
  (m) => m.role === 'user' || m.agentType === 'trend-mapper'
);
```

Then passes to `generateObject` using the `messages` parameter (confirmed in ai@6.0.134 `Prompt` interface — `dist/index.d.ts` line 701: `messages: Array<ModelMessage>`):

```typescript
const { object } = await generateObject({
  model: vertex('gemini-2.5-flash'),
  system: SLIDE_EXTRACTION_PROMPT,   // Zod-guided extraction prompt for this slide type
  messages: agentMessages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  })),
  schema: slideSchema,               // Zod schema per slide type
});
```

No DB read is needed in the slide route. The client holds the live message history. The existing rolling window already ensures the payload stays bounded (~44 messages max = ~10–20 KB JSON).

---

## Decision 3: pptxgenjs — Delivering the .pptx Buffer to the Browser

**pptxgenjs is not installed.** `package.json` has no `pptxgenjs` entry. Add: `npm install pptxgenjs`. Current stable version is 4.0.1.

pptxgenjs is Node.js only — it never runs in a browser or Edge runtime. The route handler must declare `export const runtime = 'nodejs'` (same as all existing chat routes).

**Delivery pattern — `write()` to NodeBuffer, return as `NextResponse`:**

```typescript
export const runtime = 'nodejs';

import pptxgen from 'pptxgenjs';
import { NextResponse } from 'next/server';

// After building the pptx object from the generateObject output...
const pptx = new pptxgen();
// ... add slides using object fields ...

const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;

return new NextResponse(buffer, {
  status: 200,
  headers: {
    'Content-Type':
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'Content-Disposition': `attachment; filename="slide-${type}-${projectId}.pptx"`,
    'Content-Length': String(buffer.byteLength),
  },
});
```

`pptx.write({ outputType: 'nodebuffer' })` returns `Promise<Buffer>`. This is preferred over:
- `pptx.stream()` — returns binary string, requires the deprecated `new Buffer(data, 'binary')` constructor
- `pptx.writeFile()` — writes to disk, requires tmp directory management and cleanup

**Client-side download trigger** (in `SlideGenerateButton`):

```typescript
const response = await fetch(`/api/slides/${type}/${projectId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ messages }),
});
if (!response.ok) {
  const { reason } = await response.json();
  setLastError(reason);
  return;
}
const blob = await response.blob();
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `slide-${type}.pptx`;
a.click();
URL.revokeObjectURL(url);
```

No server-side file storage, no cleanup, no extra round-trip. The blob URL approach works without any DOM link element persisted to the page.

---

## Decision 4: Button Unlock State — Where It Lives

**Answer: Client-side derived state only. No DB persistence.**

The unlock logic has two stages:

**Stage 1 — message-count heuristic (synchronous, zero cost):**
Computed from the messages array already in React state on every render:

```typescript
const THRESHOLD: Record<string, number> = {
  'trend-mapper': 3,
  'opportunity': 3,
  'value-prop': 3,
  'customer-segment': 3,
  'business-model': 3,
};

function meetsThreshold(messages: UnifiedMessage[], slideType: string, agentType: string): boolean {
  const agentAssistantMsgs = messages.filter(
    m => m.role === 'assistant' && m.agentType === agentType
  );
  return agentAssistantMsgs.length >= THRESHOLD[slideType];
}
```

Button renders disabled until threshold is met. No network call, no DB.

**Stage 2 — Gemini completeness check (async, inline in generation route):**
Rather than a separate readiness endpoint, the generation route performs the completeness check itself and returns `422` with `{ ready: false, reason: string }` if content is insufficient. The client handles this as an error state on the button. This eliminates a separate round-trip and keeps the route self-contained.

**State shape in `SlidePanel`:**

```typescript
type SlideButtonState = Record<string, {
  thresholdMet: boolean;    // derived from message count, recomputes on render
  isGenerating: boolean;    // true while POST is in flight
  lastError: string | null; // from 422 response or fetch error
}>;
```

This state lives in `SlidePanel`. It does not survive page refresh — the threshold recomputes from message history on next load, which is correct because the history is also reloaded.

No DB column, no `AppSettings` entry, no `useEffect` to persist anything.

---

## System Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│  Browser (Client Components)                                          │
│                                                                       │
│  AgentWorkspace                                                       │
│    UnifiedChatWindow                                                  │
│      messages: UnifiedMessage[]  ← full project history in state      │
│      activeAgent: string                                              │
│                                                                       │
│    SlidePanel  (new)                                                  │
│      receives: messages[], activeAgent                                │
│      SlideGenerateButton x5                                           │
│        thresholdMet: derived(messages, slideType)  ← recomputes      │
│        isGenerating: boolean                                          │
│        lastError: string | null                                       │
│        onClick → POST /api/slides/[type]/[projectId]                 │
│               → blob → synthetic <a>.click() download               │
└───────────────────────────┬──────────────────────────────────────────┘
                            │ HTTP POST  body: { messages[] }
                            │
┌───────────────────────────▼──────────────────────────────────────────┐
│  app/api/slides/[type]/[projectId]/route.ts  (NEW)                    │
│  export const runtime = 'nodejs'                                      │
│                                                                       │
│  1. Parse [type] param + body.messages                                │
│  2. Filter messages to agent-relevant turns                           │
│  3. generateObject(vertex, slideSchema[type], filtered messages)      │
│     → structured slide content (Zod-validated)                       │
│  4. If content insufficient → return 422 { ready:false, reason }     │
│  5. Build pptx via pptxgenjs using object fields                      │
│  6. pptx.write({ outputType: 'nodebuffer' }) → Buffer                │
│  7. return NextResponse(buffer, PPTX headers)                         │
└──────────┬────────────────┬──────────────────────────────────────────┘
           │                │
    Vertex AI          pptxgenjs 4.0.1
    generateObject     (Node.js only)
    (same vertex        No DB access
    instance as         (history from client)
    chat routes)
```

---

## Recommended Project Structure — New Files Only

```
app/
  api/
    slides/
      [type]/
        [projectId]/
          route.ts          New route handler — POST only

src/
  components/
    SlidePanel.tsx            New — 5 slide buttons, owns SlideButtonState map
    SlideGenerateButton.tsx   New — single button with threshold / loading / error states

  lib/
    slides/
      schemas.ts             Zod schemas for each slide type's structured output
      builders.ts            pptxgenjs construction functions, one per slide type
      thresholds.ts          THRESHOLD map: slideType → min assistant message count
      prompts.ts             SLIDE_EXTRACTION_PROMPT strings, one per slide type
```

### What Is Modified (Not Created)

| File | Change Required |
|------|-----------------|
| `src/components/AgentWorkspace.tsx` | Add `<SlidePanel messages={messages} activeAgent={activeAgent} />` below or beside `UnifiedChatWindow` |
| `package.json` | Add `"pptxgenjs": "^4.0.1"` to dependencies |

No changes to existing route handlers, context loaders, Prisma schema, or SQLite DB.

---

## Data Flow

### Slide Generation Request (Happy Path)

```
Student clicks "Generate Slide" (threshold already met)
    ↓
SlideGenerateButton.handleClick()
  setIsGenerating(true)
    ↓
POST /api/slides/trend-mapper/{projectId}
  body: { messages: [...full history from UnifiedChatWindow state...] }
    ↓
route.ts:
  filter to trend-mapper turns
  generateObject(vertex, trendMapperSlideSchema, filtered)
    ↓ (Zod-validated object returned)
  build pptxgen from object fields
  pptx.write({ outputType: 'nodebuffer' })
    ↓
  return 200  Buffer + Content-Type: application/vnd...presentation
    ↓
client:
  response.blob()
  URL.createObjectURL(blob)
  synthetic <a>.click()
  browser shows Save dialog
  URL.revokeObjectURL(url)
  setIsGenerating(false)
```

### Slide Generation Request (Content Insufficient)

```
POST /api/slides/trend-mapper/{projectId}
    ↓
route.ts:
  generateObject fails Zod validation or readiness check fails
  return 422  { ready: false, reason: "Conversation needs more trend analysis before generating this slide." }
    ↓
client:
  setLastError(reason)
  setIsGenerating(false)
  button shows inline error message
```

### Button State Lifecycle

```
New chat message arrives → messages state updated in UnifiedChatWindow
    ↓
SlidePanel re-renders (receives updated messages prop)
    ↓
for each slideType:
  count = messages.filter(agentType === relevant && role === 'assistant').length
  thresholdMet = count >= THRESHOLD[slideType]
    ↓
  button renders as:
    disabled   when thresholdMet = false
    enabled    when thresholdMet = true, isGenerating = false, lastError = null
    loading    when isGenerating = true
    error msg  when lastError != null
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Vertex AI (`generateObject`) | Same `createVertex` instance as existing chat routes | Reuse — no new credentials or config |
| pptxgenjs | `pptx.write({ outputType: 'nodebuffer' })` in Node.js route | Must `npm install pptxgenjs`; not in package.json yet |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| `SlidePanel` → slide route | `fetch` POST with JSON body | Same pattern as `UnifiedChatWindow` chat submit |
| `AgentWorkspace` → `SlidePanel` | Props: `messages`, `activeAgent` | No context provider needed |
| slide route → `generateObject` | Direct import from `ai` package | Same SDK already in use |
| slide route → `pptxgenjs` | `import pptxgen from 'pptxgenjs'` | Node.js runtime only |
| slide route → DB | None | Client sends messages; no Prisma query needed |

---

## Suggested Build Order

Five steps, ordered by testability — each step is independently verifiable before the next begins:

| Step | Deliverable | Depends On | Test Method |
|------|-------------|------------|-------------|
| **v2.1-01** | `src/lib/slides/schemas.ts` (5 Zod schemas) + `prompts.ts` (5 extraction prompts) + `thresholds.ts` | Nothing | TypeScript compilation; manual prompt review |
| **v2.1-02** | `app/api/slides/[type]/[projectId]/route.ts` returning structured JSON (skip pptxgenjs for now; return `object` as JSON 200) | v2.1-01 | `curl -X POST` with hard-coded messages payload; verify schema output |
| **v2.1-03** | `src/lib/slides/builders.ts` + wire pptxgenjs into route to return actual `.pptx` buffer | v2.1-02 | `curl` to download file; open in PowerPoint/LibreOffice to verify |
| **v2.1-04** | `SlideGenerateButton.tsx` + `SlidePanel.tsx` | v2.1-03 | Component renders; button triggers fetch; download dialog appears |
| **v2.1-05** | Wire `SlidePanel` into `AgentWorkspace`; show only for Trend Mapper + Value Designer agents | v2.1-04 | End-to-end browser test |

Steps v2.1-01 through v2.1-03 are pure server-side and require no UI changes. The API contract is fixed and manually verified before any React code is written.

---

## Anti-Patterns

### Anti-Pattern 1: generateObject Inside the Chat Route

**What people do:** Add a `slideType` flag to the existing chat POST and branch between `streamText` and `generateObject` in the same handler.
**Why it's wrong:** `streamText` commits to a streaming SSE response immediately. `generateObject` is blocking and returns JSON. The two response shapes cannot be unified in one handler without duplicating all response-building code. The route's responsibility becomes ambiguous.
**Do this instead:** Separate route at `app/api/slides/[type]/[projectId]/route.ts`.

### Anti-Pattern 2: Persisting Button State to the DB

**What people do:** Add a `readinessChecked: boolean` column to `Message` or `Project`, or an `AppSettings` entry, to cache the completeness check result.
**Why it's wrong:** PROJECT.md explicitly constrains this milestone to no DB schema changes. Also unnecessary — threshold derivation is a free count filter on client-side state; the Gemini completeness check runs inline in the generation route only when the student actually clicks Generate.
**Do this instead:** Derive from the messages array in `SlidePanel` render; cache inline 422 reason in `useState` keyed by slideType.

### Anti-Pattern 3: Writing pptx to Disk and Serving a File URL

**What people do:** `pptx.writeFile('/tmp/slide.pptx')` then redirect the client to a static URL.
**Why it's wrong:** Requires tmp directory management, file cleanup, potential race conditions (even on single-user), and an extra request round-trip. Next.js deployments may not have a writable filesystem outside of `public/`.
**Do this instead:** `pptx.write({ outputType: 'nodebuffer' })` and return the buffer directly in the `NextResponse`. The client creates a blob URL and triggers the download without intermediate storage.

### Anti-Pattern 4: DB Read for Conversation History in the Slide Route

**What people do:** Query `prisma.message.findMany({ where: { projectId } })` inside the slide route instead of reading from the request body.
**Why it's wrong:** The client already holds the full live message history in state (including any messages that may not yet be persisted due to timing). A DB read adds latency and can miss the most recent turn. The existing chat routes already moved to client-sent history after Phase 9.
**Do this instead:** Client sends `messages` in the POST body; route uses them directly. Rolling window already caps the payload size.

### Anti-Pattern 5: pptxgenjs in Edge or Middleware

**What people do:** Forget to set `export const runtime = 'nodejs'` and let Next.js default to Edge on certain deployment targets.
**Why it's wrong:** pptxgenjs uses Node.js-specific APIs (Buffer, JSZip with Node streams). It will throw at runtime in the Edge runtime.
**Do this instead:** Always declare `export const runtime = 'nodejs'` in the slide route — same as all existing chat routes.

---

## Scaling Considerations

This is a single-user application. The pptxgenjs buffer pattern holds the generated PPTX (~50–200 KB) in server memory for the ~2–4 seconds the combined `generateObject` + build takes. Acceptable at any realistic single-user load.

If v3 adds multi-user: the buffer approach scales fine until concurrent slide generations exhaust Node.js heap. At that point, offload generation to a background job queue and return a job ID for polling.

---

## Sources

- `generateObject` parameter signature: `/node_modules/ai/dist/index.d.ts` lines 681–701, ai@6.0.134, installed and read directly
- pptxgenjs export methods: [Saving Presentations | PptxGenJS](https://gitbrent.github.io/PptxGenJS/docs/usage-saving/) — `write({ outputType: 'nodebuffer' })` returns `Promise<Buffer>`, confirmed
- pptxgenjs version 4.0.1: [npm pptxgenjs](https://www.npmjs.com/package/pptxgenjs)
- Existing Trend Mapper chat route pattern: `app/api/chat/[projectId]/route.ts`, read directly from repo
- Existing client history pattern: `src/components/UnifiedChatWindow.tsx`, read directly from repo
- AI SDK 6 release: [https://vercel.com/blog/ai-sdk-6](https://vercel.com/blog/ai-sdk-6)

---

*Architecture research for: Slide generation integration — FUND II AI Agent Platform v2.1*
*Researched: 2026-03-22*
