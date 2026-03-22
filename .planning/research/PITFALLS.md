# Pitfalls Research

**Domain:** AI-powered slide generation added to an existing Next.js multi-agent chat app (pptxgenjs + Gemini generateObject + progressive unlock)
**Project:** FUND II — v2.1 Slide Generation milestone
**Researched:** 2026-03-22
**Confidence:** MEDIUM-HIGH — Core claims verified against pptxgenjs official docs, Vercel AI SDK docs, Next.js App Router route handler docs, and direct codebase inspection. generateObject behavior claims verified against multiple GitHub issues and official SDK error reference. Readiness detection and UX pitfalls drawn from first-principles analysis of the existing codebase and general LLM structured output failure modes.

---

## Critical Pitfalls

---

### Pitfall 1: pptxgenjs Imported in a File That Reaches the Browser Bundle

**What goes wrong:** pptxgenjs is a server-only library. If it is imported — even transitively — in any file that is bundled for the browser (a Client Component, a shared utility imported by both client and server code, or a context file), the build fails with `ReferenceError: window is not defined` during Next.js server-side render, or silently produces a broken bundle in the client.

**Why it happens:** pptxgenjs has two distributions: a browser bundle (`pptxgen.bundle.js`) that polyfills Node APIs, and a CJS Node build (`pptxgen.cjs.js`). When Next.js bundles a file that `import`s `pptxgenjs` at the top level without the `nodejs` runtime guard, the bundler pulls in the CJS build which references `process`, `Buffer`, and `fs` — causing the error. This is especially likely if a developer creates a shared `generateSlide.ts` helper and imports it from both an API route and a Client Component.

**How to avoid:** pptxgenjs must only be imported inside `app/api/` route handlers with `export const runtime = 'nodejs'` declared. Never import it from `src/components/`, `src/lib/`, or any file without a server-only boundary. Use `import 'server-only'` at the top of any utility that wraps pptxgenjs:
```typescript
// src/lib/slides/generate-slide.ts
import 'server-only'
import pptxgen from 'pptxgenjs'
```
This causes Next.js to throw at build time if the file is ever imported from a Client Component.

**Warning signs:** Build error containing `Module not found: Can't resolve 'fs'` or `window is not defined` originating from inside `pptxgenjs/`. The error appears at `next build` time, not at runtime.

**Phase to address:** Slide generation phase (v2.1), when pptxgenjs is first introduced. Set the `server-only` guard on Day 1 before writing any slide generation logic.

---

### Pitfall 2: Using `write('nodebuffer')` and Returning the Buffer as a Response Without Correct Headers

**What goes wrong:** The browser receives the `.pptx` file but either (a) displays it as raw binary in the browser tab instead of downloading it, or (b) the file downloads but is corrupt because the `Content-Type` or `Content-Disposition` header is wrong, causing the browser to apply text encoding to binary data.

**Why it happens:** `pptx.write({ outputType: 'nodebuffer' })` returns a `Promise<Buffer>`. Developers pass this Buffer directly to `new Response(buffer)` without setting MIME type or disposition. The correct MIME type for PPTX is `application/vnd.openxmlformats-officedocument.presentationml.presentation` — using `application/octet-stream` works but causes some browsers to block or warn. Missing `Content-Disposition: attachment; filename="..."` means the browser renders rather than saves.

**How to avoid:** The exact response construction for a PPTX binary download in an App Router route handler:
```typescript
export const runtime = 'nodejs'

export async function POST(req: Request, { params }: ...) {
  const pptx = new pptxgen()
  // ... build slides ...
  const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer

  return new Response(buffer, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': 'attachment; filename="trend-mapper-slide.pptx"',
      'Content-Length': buffer.length.toString(),
      'Cache-Control': 'no-store',
    },
  })
}
```
Do not use `NextResponse.json()` for binary responses. `NextResponse` wraps responses in JSON serialization that corrupts binary data.

**Warning signs:** Downloaded file opens in PowerPoint with "File is corrupt" error. File size is much smaller or larger than expected. Browser opens a new tab with garbled content instead of triggering a download.

**Phase to address:** Slide generation API route (v2.1). Smoke-test the download end-to-end with a minimal single-slide deck before wiring up any real content.

---

### Pitfall 3: generateObject Called With All Required Fields — Model Hallucinates Missing Content

**What goes wrong:** When the Zod schema for slide extraction makes all fields required (e.g., `trendName: z.string()`, `keyInsight: z.string()`), Gemini will always populate every field — even when the conversation does not contain that information. It hallucinates plausible-sounding content for fields that are absent from the conversation, producing slides with fabricated trend names or made-up statistics.

**Why it happens:** `generateObject` uses Gemini's structured output mode (JSON schema enforcement). The model is constrained to return a valid object matching the schema. If a required field has no corresponding information in the conversation history, the model invents something rather than failing validation.

**How to avoid:** Mark fields that may legitimately be absent as `.optional()` or `.nullable()` in Zod:
```typescript
const TrendSlideSchema = z.object({
  trendName: z.string().describe('The primary megatrend name identified'),
  headline: z.string().describe('One-line summary of the trend'),
  keyInsight: z.string().optional().describe('Most important insight — omit if not discussed'),
  evidence: z.array(z.string()).optional().describe('Specific evidence points mentioned — omit if none'),
  implication: z.string().optional().describe('Strategic implication — omit if not discussed'),
})
```
Then handle optional fields in pptxgenjs slide construction: only add a text box if the field is defined. This produces a sparser but honest slide rather than a complete but fabricated one.

**Warning signs:** Generated slides contain plausible but unrecognizable content. Fields show boilerplate text like "N/A" or generic trend descriptions that don't match the actual conversation. Students report the slides don't reflect what they discussed.

**Phase to address:** Slide generation API route (v2.1). Define the Zod schema with `.optional()` from the start. Verify with real conversation transcripts, not synthetic test data.

---

### Pitfall 4: generateObject Throws `NoObjectGeneratedError` — No Error Boundary in the Route Handler

**What goes wrong:** When Gemini fails to produce a valid JSON object conforming to the Zod schema (network error, token budget exceeded, model refusal, or schema too complex), the AI SDK throws `AI_NoObjectGeneratedError`. If the route handler has no try/catch around the `generateObject` call, this produces an unhandled 500 with no actionable message for the student.

**Why it happens:** Developers who successfully test `generateObject` in a happy path often skip error handling. The failure modes are not obvious during development (they appear under production-like token loads or with certain conversation patterns). The error is not a network error — it's a validation error thrown by the SDK after receiving a response.

**How to avoid:** Always wrap `generateObject` in a try/catch and return structured errors:
```typescript
import { generateObject, NoObjectGeneratedError } from 'ai'

try {
  const { object } = await generateObject({ model, schema: TrendSlideSchema, prompt })
  // ... proceed
} catch (err) {
  if (err instanceof NoObjectGeneratedError) {
    return NextResponse.json(
      { error: 'Could not extract slide content from this conversation. Try continuing the conversation.', code: 'EXTRACTION_FAILED' },
      { status: 422 }
    )
  }
  // ... other errors
}
```
Do not retry automatically more than once — repeated `generateObject` calls on a long conversation double the Vertex AI cost per generation attempt.

**Warning signs:** Unhandled `NoObjectGeneratedError` in server logs. Frontend shows generic "500 Internal Server Error" with no helpful message when students click Generate. Occurs more frequently with very short conversations (fewer than 6 messages) where schema fields have no content to extract.

**Phase to address:** Slide generation API route (v2.1). Handle this error before the feature goes to any user testing.

---

### Pitfall 5: Wrong `agentType` Filter When Reading Conversation History for Slide Extraction

**What goes wrong:** The `generateObject` prompt is built by fetching message history from the database. If the Prisma query omits the `agentType` filter, it returns messages from all agents (Trend Mapper, Value Designer, SPI, FARO) interleaved. The slide extractor receives a mixed, incoherent conversation and produces garbage or hallucinates content from a different agent's topic.

**Why it happens:** This is unique to the multi-agent architecture added in v2.0. The `Message` table has an `agentType` column, but it is `String?` (nullable) for Trend Mapper messages created before v2.0 (when `agentType` was added). A developer writing a new slide API route may query `Message.findMany({ where: { projectId } })` — correct for the original single-agent app, catastrophically wrong for the multi-agent app.

**How to avoid:** Every query to `Message` for slide generation must filter by both `projectId` and `agentType`:
```typescript
// For Trend Mapper slide generation
const messages = await prisma.message.findMany({
  where: {
    projectId,
    agentType: 'trend-mapper',  // REQUIRED
  },
  orderBy: { createdAt: 'asc' },
})
```
Additionally, the `agentType` column is nullable for legacy Trend Mapper messages (pre-v2.0). Use `OR` logic to include null-agentType messages for backward compatibility when querying Trend Mapper history:
```typescript
where: {
  projectId,
  OR: [
    { agentType: 'trend-mapper' },
    { agentType: null },  // legacy messages from v1.0
  ],
}
```

**Warning signs:** Slide generated for Value Designer contains trend research content. Slide generated for Trend Mapper contains persona or business model content. Symptoms are intermittent and depend on which agents the student has used.

**Phase to address:** Slide generation API route (v2.1), in the prompt-building step. Write a test with a project that has messages from multiple agents before shipping.

---

### Pitfall 6: Readiness Heuristic Is True But LLM Completeness Check Is Called on Every Render

**What goes wrong:** The two-stage readiness check (message-count heuristic → Gemini completeness check) is designed so the cheap heuristic runs first. If the completeness check is triggered on every component render (e.g., in a `useEffect` with no debounce, called every time the message list re-renders), the app makes a Gemini API call for every new message received — including mid-stream. This costs real money and introduces noticeable latency to every chat turn.

**Why it happens:** React state updates from streaming trigger re-renders. A `useEffect` that watches `messages.length` and triggers the completeness check fires once per message chunk if the streaming UI updates incrementally, or once per turn if updates are batched. Developers often write the initial version as `useEffect(() => { checkReadiness() }, [messages])` without considering streaming re-renders.

**How to avoid:**
1. Run the Gemini completeness check only when the heuristic threshold is first crossed, not on every render after that.
2. Debounce the check: wait 2 seconds after the last message before calling the completeness API.
3. Cache the result: once `isReady: true` is returned, store it in state and do not re-check until a new user message is sent.
4. Run the completeness check server-side as part of the chat response (append a `readiness` metadata field to the chat response), so no separate client-initiated API call is needed.

**Warning signs:** Network tab shows repeated calls to `/api/slides/readiness` during a single chat turn. Each call corresponds to a streaming chunk update. Server logs show the completeness check running 10-15 times per conversation turn.

**Phase to address:** Readiness detection implementation (v2.1). Establish the debounce + cache pattern in the initial implementation, not as a follow-up optimization.

---

### Pitfall 7: Button Unlocks Then Re-Locks — Student Confusion and Lost Context

**What goes wrong:** The "Generate Slide" button unlocks when the completeness check returns `true`. But if the student continues the conversation after that point, the next re-render triggers another completeness check (if not cached), which returns a different result (model non-determinism, or a stricter prompt), and the button re-locks. Students who saw the button become active are confused when it disappears.

**Why it happens:** LLM completeness checks are non-deterministic. The same conversation re-evaluated twice at different temperatures or with slightly different prompting may return `ready: false` after previously returning `ready: true`. If the button state is driven purely by live re-evaluation without hysteresis, it oscillates.

**How to avoid:** Apply a one-way latch: once a slide type is marked ready, it stays ready for the duration of the session unless the conversation is explicitly reset. Do not re-evaluate readiness after the threshold is crossed:
```typescript
const [readySlides, setReadySlides] = useState<Set<string>>(new Set())

// Only update to true — never remove from the set
function markReady(slideType: string) {
  setReadySlides(prev => new Set([...prev, slideType]))
}
```
This means a button that unlocked never re-locks, which is the correct UX: once there's enough content, there's always enough content.

**Warning signs:** Button is visible during one session, then absent in the next without the conversation changing. Students report "the button appeared and then disappeared." Completeness check API is called multiple times per session.

**Phase to address:** Readiness detection + button UI (v2.1). Implement the one-way latch from the start, not as a bug fix after user confusion.

---

### Pitfall 8: `generateObject` Context Budget Blown by Full Conversation History

**What goes wrong:** The slide extraction prompt passes the full conversation history (potentially 30+ turns, with megatrend docs already injected by the chat agent). When the conversation is long, the `generateObject` call exceeds the token budget for the model or produces a truncated extraction because the model runs out of output tokens mid-schema.

**Why it happens:** This project already uses a rolling window for chat (FIRST_KEEP=4, LAST_KEEP=40 = 44 messages max). However, for slide extraction, 44 messages of detailed research conversation — each turn potentially 500-1000 tokens — can total 20,000–40,000 tokens. The slide extraction schema is also injected as a system prompt. Combined, this can approach Gemini 2.5 Flash's effective output budget for structured generation.

**How to avoid:**
1. For slide extraction, do not re-inject the megatrend docs. The conversation already contains the synthesized insights — inject only the raw conversation turns.
2. Apply a tighter rolling window for extraction: last 20 messages (10 turns) is sufficient for slide content that reflects the most recent conclusions.
3. Instruct the model to extract only what is present, not to summarize exhaustively.
4. Set `maxTokens` explicitly on the `generateObject` call to bound output size.

**Warning signs:** `generateObject` takes > 8 seconds for slide extraction on long conversations. Schema validation fails intermittently on long sessions but succeeds on short ones. Partial objects returned (some fields populated, others empty) on dense conversations.

**Phase to address:** Slide generation API route (v2.1), in the prompt assembly step.

---

### Pitfall 9: pptxgenjs Runs in the Same Request as generateObject — Combined Latency Exceeds Default Route Timeout

**What goes wrong:** A single slide generation request does: (1) DB query for conversation history, (2) `generateObject` LLM call (5–15 seconds), (3) pptxgenjs slide build (synchronous, 100ms), (4) binary response. This can run 10–20 seconds total. On Vercel's Hobby plan, serverless functions time out at 10 seconds. On the Pro plan, the default is 15 seconds without explicit `maxDuration`.

**Why it happens:** Self-hosted Next.js (as used here, run locally) has no serverless timeout, so developers don't notice the issue during development. If the app is later deployed to Vercel or a container with a proxy that has a 10-second gateway timeout, the generation silently fails at the proxy level — the server finishes but the client receives a 504.

**How to avoid:** Add `export const maxDuration = 60` to the slide generation route handler. This is a no-op for local Next.js but essential for any hosted environment:
```typescript
export const runtime = 'nodejs'
export const maxDuration = 60  // seconds — required for Vercel Pro+

export async function POST(req: Request, ...) { ... }
```
Also add a loading state in the UI that makes a 15-second wait feel acceptable rather than broken.

**Warning signs:** Slide generation works consistently in `next dev` but fails in production after exactly N seconds (the proxy timeout). Client receives empty response or 504 with no error message.

**Phase to address:** Slide generation API route (v2.1). Add `maxDuration` even if currently self-hosted — it future-proofs deployment.

---

### Pitfall 10: Zod Schema Has Deeply Nested Objects — Vertex AI/Gemini Structured Output Rejects the Schema

**What goes wrong:** Gemini's structured output mode (used by `generateObject`) does not support all JSON Schema features that Zod produces. Specifically: recursive schemas, `z.union()` with more than 2-3 members, `z.discriminatedUnion()`, and deeply nested objects (more than 3 levels) can cause the structured output call to fail with a `400 Bad Request` or produce a `NoObjectGeneratedError` even when the prompt is correct.

**Why it happens:** The path from Zod → JSON Schema (via `zod-to-json-schema`) → Vertex AI structured output introduces two layers of translation. The JSON schema representation Vertex AI accepts is a strict subset of full JSON Schema. Complex Zod types that serialize to `oneOf`, `anyOf`, or `$ref` patterns in JSON Schema fail at the Vertex AI layer.

**How to avoid:** Keep slide extraction schemas flat. For 5 slide types, use 5 separate simple schemas rather than one polymorphic schema:
```typescript
// GOOD: flat, 1 level of nesting max
const TrendMapperSlideSchema = z.object({
  trendName: z.string(),
  headline: z.string(),
  insights: z.array(z.string()),  // array of strings, not array of objects
})

// BAD: nested objects inside arrays inside objects
const BadSchema = z.object({
  sections: z.array(z.object({
    title: z.string(),
    items: z.array(z.object({ label: z.string(), value: z.string() }))
  }))
})
```
Test each schema with the actual Gemini model and a representative prompt before building slide logic on top of it.

**Warning signs:** `generateObject` call fails with 400 or produces `NoObjectGeneratedError` on the first call, before any token budget issues. Replacing a complex schema with a simpler one fixes it immediately.

**Phase to address:** Slide schema design (v2.1), before writing any pptxgenjs rendering code. Validate the schema works with a real Gemini call first.

---

## Technical Debt Patterns

Shortcuts that seem reasonable but create long-term problems.

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Making all schema fields required | Simpler code, always-complete slides | Slides contain hallucinated content for absent fields | Never acceptable |
| Single `/api/slides/generate` route that handles all 5 slide types via a `type` query param | One route to maintain | Mixing schemas and pptxgenjs templates in one file; hard to test and extend | MVP only if clearly commented and separated into functions |
| Running completeness check on every message | Simplest implementation | Gemini calls on every chat turn; cost and latency visible to users | Never acceptable — debounce from day one |
| Returning `base64` instead of `nodebuffer` from pptxgenjs and decoding client-side | Avoids binary response complexity | Base64 is 33% larger; decode in browser adds JS work; CORS + fetch complexity | Never acceptable — binary from server is cleaner |
| Building slide templates inline in the route handler | Fast initial development | Slide styling becomes unmaintainable; impossible to iterate on design | MVP only |

---

## Integration Gotchas

Common mistakes when connecting to existing systems.

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| pptxgenjs + Next.js App Router | Importing pptxgenjs in a shared util file that is also imported by Client Components | Import only inside `app/api/` routes; add `import 'server-only'` to any slide utility module |
| generateObject + Vertex AI (via @ai-sdk/google-vertex) | Assuming generateObject uses the same `vertex()` instance as streamText without checking structured output support | Verify `gemini-2.5-flash` supports structured output via the AI SDK provider; test with a real call |
| Slide generation + existing Message schema | Querying messages without `agentType` filter returns cross-agent conversation | Always filter by `agentType` in slide generation queries; handle nullable agentType for v1.0 Trend Mapper messages |
| pptxgenjs Buffer + Next.js Response | Passing a Node.js `Buffer` to `new Response()` directly — works in some Node versions, breaks in others | Convert to `Uint8Array`: `new Uint8Array(buffer)` or use `Buffer.from()` explicitly; test on the exact Node.js version used |
| Readiness check + streaming chat | Triggering readiness check while streaming is in progress | Check only on `onFinish` events (assistant message completed), never on partial chunks |

---

## Performance Traps

Patterns that work at small scale but fail as usage grows.

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Completeness check called per render | Gemini API calls per chat chunk; visible latency | One-way latch + debounce; check only on message completion | At first real student session |
| Full conversation + megatrend docs in generateObject prompt | 20–40 second extraction on long sessions | Strip megatrend docs from extraction prompt; use last 20 messages only | Long conversations (15+ turns) |
| pptxgenjs building complex multi-image slides | Synchronous image embedding blocks the Node thread | Keep slides text-only for MVP; images are a post-MVP feature | Slides with embedded images |
| All 5 slide types regenerated in a single request | One slow request blocks the entire UI | Generate one slide type per request; let UI trigger generation individually | First multi-slide project |

---

## UX Pitfalls

Common user experience mistakes in this domain.

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Button unlocks and re-locks non-deterministically | Student confusion; "why did the button disappear?" | One-way latch: once unlocked, never re-locks in the same session |
| No progress indicator during generation (10-15s wait) | Students click Generate multiple times thinking it failed | Show a spinner or "Generating..." state immediately; disable button during generation |
| Generated slide filename is generic ("slide.pptx") | Multiple downloads in the same session are indistinguishable | Use project name + slide type + timestamp: `fund2-trend-mapper-2026-03-22.pptx` |
| Error message says "Internal Server Error" when extraction fails | Student has no idea whether to try again or if something is wrong | Return specific error: "Not enough conversation content yet — continue the discussion and try again" |
| Completeness check shows button only for the current agent tab | Student forgets which agents have ready slides | Consider a subtle indicator on all agent tabs, not just the active one |

---

## "Looks Done But Isn't" Checklist

Things that appear complete but are missing critical pieces.

- [ ] **pptxgenjs integration:** Route generates and returns data — verify the downloaded file actually opens in PowerPoint/Keynote, not just that the download triggers.
- [ ] **generateObject schema:** Schema validates against training data — verify against a real conversation from the app, not a hand-crafted test prompt.
- [ ] **agentType filter:** Query returns messages — verify it returns ONLY Trend Mapper messages on a project that also has Value Designer messages.
- [ ] **Readiness button:** Button unlocks — verify it does not re-lock when a new message arrives after unlocking.
- [ ] **Binary response headers:** File downloads — verify the MIME type is correct and PowerPoint recognizes it as a valid presentation (not just an unrecognized binary blob).
- [ ] **Error handling:** Error path tested — verify `NoObjectGeneratedError` returns a 422 with a human-readable message, not a 500.
- [ ] **Timeout handling:** Works in dev — verify `export const maxDuration` is set for any hosted environment.
- [ ] **Legacy messages:** Slide generation works for the current project — verify it also works on a project that has messages from v1.0 (null agentType).

---

## Recovery Strategies

When pitfalls occur despite prevention, how to recover.

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| pptxgenjs imported in client bundle | LOW | Move import to `app/api/` route; add `server-only` guard; `next build` confirms fix |
| Corrupt PPTX download | LOW | Check `Content-Type` and `Content-Disposition` headers in Network tab; verify `outputType: 'nodebuffer'` is used, not `'base64'` |
| generateObject hallucinating required fields | MEDIUM | Change required fields to `.optional()` in Zod schema; update pptxgenjs renderer to handle undefined fields; re-test |
| Completeness check over-firing | LOW | Add debounce + one-way latch; no schema or API changes required |
| Cross-agent message contamination | LOW | Add `agentType` filter to Prisma query; handle null agentType for legacy messages |
| NoObjectGeneratedError in production | LOW | Add try/catch with 422 response; optionally add one retry |
| Schema rejected by Vertex AI structured output | MEDIUM | Flatten schema; remove nested objects; test each schema independently; rebuild pptxgenjs templates to match flatter data structure |

---

## Pitfall-to-Phase Mapping

How roadmap phases should address these pitfalls.

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| pptxgenjs bundled in client | Slide generation API route setup | `next build` output shows no client-side pptxgenjs import |
| Wrong binary response headers | Slide download route implementation | Downloaded file opens correctly in PowerPoint |
| Required fields causing hallucination | Zod schema design | Review schema; all fields that may be absent are `.optional()` |
| NoObjectGeneratedError unhandled | Slide generation API route | Test with a 2-message conversation (insufficient content) |
| Wrong agentType filter | Slide generation API route | Test on a project with messages from 2+ agents |
| Completeness check over-firing | Readiness detection implementation | Network tab shows at most 1 completeness check per completed assistant turn |
| Button re-locking | Readiness button UI | Button never disappears once it appears in a session |
| Context budget blown by conversation + docs | Prompt assembly for generateObject | Measure tokens before and after stripping megatrend docs from extraction prompt |
| Combined latency timeout | Slide generation API route setup | Add `maxDuration = 60` to route; test with a 30-turn conversation |
| Complex Zod schema rejected | Slide schema design (before any rendering code) | Each schema tested independently with a real Gemini call |

---

## Sources

- pptxgenjs official saving docs (verified 2026-03): https://gitbrent.github.io/PptxGenJS/docs/usage-saving/
- Vercel AI SDK generateObject reference: https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-object
- Vercel AI SDK error reference (NoObjectGeneratedError): https://ai-sdk.dev/docs/reference/ai-sdk-errors/ai-no-object-generated-error
- AI SDK GitHub issue — generateObject fails without structuredOutputs: https://github.com/vercel/ai/issues/9002
- AI SDK GitHub issue — schema validation failures with embedded objects: https://github.com/vercel/ai/issues/7358
- Next.js App Router route handlers — binary download patterns: https://github.com/vercel/next.js/discussions/51676
- Next.js maxDuration configuration: https://nextjs.org/docs/app/api-reference/file-conventions/route
- pptxgenjs GitHub — HTTP streaming issue (Node.js binary encoding): https://github.com/gitbrent/PptxGenJS/issues/35
- Existing project codebase — Message schema, agentType nullable column, rolling window implementation: read directly

---
*Pitfalls research for: AI-powered slide generation added to existing Next.js multi-agent chat app*
*Researched: 2026-03-22*
