# Domain Pitfalls

**Domain:** Next.js 14 App Router + Vertex AI Gemini streaming chat + SQLite/Prisma + gcloud ADC
**Project:** FUND II Trend Mapper
**Researched:** 2026-03-21
**Confidence:** MEDIUM — Core claims verified against Next.js official docs (v16.2.1, March 2026) and direct project file inspection. Vertex AI, Prisma, and ADC claims draw on training data through August 2025 with no contradicting evidence found; flagged where verification was blocked.

---

## Critical Pitfalls

Mistakes that cause broken streaming, silent auth failures, or rewrites.

---

### Pitfall 1: Edge Runtime Silently Breaks Vertex AI SDK

**What goes wrong:** The Vertex AI Node.js SDK (`@google-cloud/vertexai`) uses Node.js-native APIs — specifically `google-auth-library`, which uses `fs` to read credential files and `child_process` in some auth flows. If the chat API route runs under the Edge runtime (Next.js default in some configurations), these imports fail at build time or silently return empty responses at runtime.

**Why it happens:** Next.js App Router routes default to Node.js runtime, but developers sometimes add `export const runtime = 'edge'` thinking it improves performance for AI routes. The Edge runtime runs a V8 sandbox without Node.js built-ins. The Vertex AI SDK is not edge-compatible.

**Consequences:** Build succeeds but requests fail with cryptic module errors like `Module not found: Can't resolve 'fs'` or auth silently falls back to unauthenticated requests returning 403s.

**Prevention:** Explicitly declare Node.js runtime in every route that touches Vertex AI:
```typescript
// app/api/chat/route.ts
export const runtime = 'nodejs'
```
Never add `export const runtime = 'edge'` to AI routes. Verify with `next build` — the build output lists each route's runtime.

**Detection:** Build warnings mentioning `fs`, `net`, `tls` in edge routes. Runtime 403 errors that work fine locally but fail in production.

---

### Pitfall 2: Vertex AI Streaming AsyncIterator Not Bridged to ReadableStream Correctly

**What goes wrong:** The Vertex AI Node.js SDK returns streaming responses as an `AsyncIterable` (via `generateContentStream`). Wrapping it incorrectly in a `ReadableStream` causes the stream to close immediately, produce no chunks, or throw on the second iteration.

**Why it happens:** Two common mistakes:
1. Calling `for await...of` inside the `ReadableStream` constructor's `start` method (which is synchronous-context) and pushing all chunks before the stream can backpressure.
2. Using the `.stream` property vs `.response` property incorrectly — the SDK exposes both, and using `.response` gives a Promise<complete response>, not a stream.

**Consequences:** The frontend receives an empty response or the full response arrives only after the entire generation completes (defeating streaming). The UI "freezes" then dumps all text at once.

**Prevention:** Use the `pull`-based `ReadableStream` constructor pattern, wrapping the async iterator explicitly:
```typescript
const { stream } = await vertexClient.generateContentStream(request)

const readable = new ReadableStream({
  async pull(controller) {
    const { value, done } = await stream[Symbol.asyncIterator]().next()
    if (done) {
      controller.close()
    } else {
      const text = value.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      controller.enqueue(new TextEncoder().encode(text))
    }
  }
})
return new Response(readable, {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' }
})
```
Alternatively, use Vercel AI SDK's `@ai-sdk/google-vertex` provider which handles this bridging automatically.

**Detection:** Client receives full response with no incremental chunks. Network tab shows single large response chunk rather than a stream of small chunks.

---

### Pitfall 3: gcloud ADC Credential File Not Found in Next.js Server Environment

**What goes wrong:** `gcloud auth application-default login` writes credentials to `~/.config/gcloud/application_default_credentials.json`. When Next.js runs as a server process (especially in Docker, CI, or when started by a process manager), the home directory resolves differently and the credential file is not found. Auth silently falls back to no credentials, producing 401/403 from Vertex AI.

**Why it happens:** ADC searches for credentials in this order:
1. `GOOGLE_APPLICATION_CREDENTIALS` env var (points to a service account JSON file)
2. `~/.config/gcloud/application_default_credentials.json` (gcloud user credentials)
3. GCE/GKE metadata server (only on Google Cloud infrastructure)

When `next dev` or `next start` is run by a different user, in a Docker container, or via a process manager that doesn't inherit the shell environment, `~` resolves to a different path or the file doesn't exist.

**Consequences:** `Error: Could not load the default credentials` at runtime. Requests to Vertex AI fail with 401 or throw before reaching the API.

**Prevention — local development:**
Set `GOOGLE_APPLICATION_CREDENTIALS` explicitly in `.env.local`:
```bash
GOOGLE_APPLICATION_CREDENTIALS=/Users/rajas/.config/gcloud/application_default_credentials.json
```
Find the exact path with `gcloud auth application-default print-access-token` — if it succeeds, credentials exist; note the path from `gcloud info | grep "ADC"`.

**Prevention — production deployment:**
Never ship gcloud user credentials to production. Use a service account JSON key:
```bash
gcloud iam service-accounts create trend-mapper-sa
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:trend-mapper-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"
gcloud iam service-accounts keys create key.json \
  --iam-account=trend-mapper-sa@PROJECT_ID.iam.gserviceaccount.com
```
Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` in the production environment. Do NOT commit `key.json` to git.

**Detection:** `gcloud auth application-default print-access-token` succeeds in the terminal but Next.js routes return auth errors. Check the process's actual home directory: `console.log(process.env.HOME)` in the route handler.

---

### Pitfall 4: Megatrend Docs Exceed Practical Context Window Budget

**What goes wrong:** The three megatrend .docx files total ~131KB compressed. When extracted as plain text, DOCX XML decompresses to raw text of approximately 40,000–80,000 words across the three documents. At ~1.3 tokens/word, that is roughly 50,000–100,000 tokens of megatrend context alone. Combined with the ~2,000-word system prompt (~2,600 tokens) and a multi-turn conversation with history, you can easily breach the usable context window.

**Why it happens:** Gemini 1.5 Pro has a 1M token context window on paper, but:
- Vertex AI has per-request input token quotas (default quota is often 32K tokens/minute for some regions/tiers)
- Very long contexts degrade response quality — the model "loses focus" on recent turns when the context is dominated by static documents
- Per-request costs scale with tokens, and every chat turn re-sends the entire context including all documents
- The PDF/handout in the megatrend folder (Spotting_Big_Trends_Megatrends_Handout.pdf, 31KB) has not been extracted — if injected as raw binary it produces garbage

**Consequences:** Requests fail with `400 Request too large` or `quota exceeded` errors. Costs balloon as every message re-sends ~80K tokens. Response quality degrades for long conversations as the system prompt pedagogy gets buried.

**Prevention:**
1. Extract documents to plain text at build time (not at request time) using a script. Store extracted text in `lib/context/` as `.txt` files.
2. Measure token count with the Vertex AI `countTokens` API before committing to a strategy.
3. Truncate aggressively: the handout PDF is likely ~5,000 tokens of actual content; the deep research DOCX files may be 20,000–40,000 tokens each. Budget a maximum of 30,000 tokens for megatrend context.
4. If docs exceed budget, summarize each document into a condensed reference (3,000–5,000 tokens each) rather than injecting full text. Do this once at setup, not per-request.
5. Place megatrend context in the `systemInstruction` field (not in `contents`), as Vertex AI handles system instructions more efficiently.

**Detection:** Run `countTokens` on the assembled prompt before going live. Alert if total prompt tokens exceed 40,000.

---

### Pitfall 5: Prisma Client Instantiated per Hot-Reload in Next.js Development

**What goes wrong:** In Next.js `next dev`, the module cache is refreshed on every file change. If `new PrismaClient()` is called at module level (e.g., `const prisma = new PrismaClient()` in `lib/prisma.ts`), each hot-reload creates a new client instance. Prisma's SQLite driver opens new file handles with each instance. After a few reloads, you hit the SQLite `SQLITE_BUSY` or `too many open connections` error.

**Why it happens:** Node.js hot module replacement (HMR) doesn't fully close previous module instances. Each reload calls the module initializer again, creating another live `PrismaClient`.

**Consequences:** `PrismaClientInitializationError: Unable to open the database file` or random `SQLITE_BUSY: database is locked` errors during development that disappear on a cold server restart.

**Prevention:** Use the global singleton pattern recommended by Prisma for Next.js:
```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```
`globalThis` persists across HMR cycles, so only one client is ever created per server process lifetime.

**Detection:** SQLite lock errors that appear only after editing files and saving, but work after `Ctrl+C` + `npm run dev`. Error count increases with each file save.

---

### Pitfall 6: SQLite WAL Mode Not Enabled — Concurrent Reads Block Writes

**What goes wrong:** By default, SQLite uses journal mode `DELETE` (rollback journal). In a Next.js app with multiple simultaneous API requests (e.g., loading the project list while a chat is streaming), a write transaction on one request blocks all reads on other requests. Under any real usage with streaming (long-lived write transactions), this produces `SQLITE_BUSY` for every concurrent read.

**Why it happens:** SQLite's default locking model allows only one writer at a time and blocks all readers during writes. Chat message persistence (writing each message) holds a write lock for the duration of the INSERT, which can be milliseconds but during streaming may be called repeatedly.

**Consequences:** The project list page fails to load while a chat is active. API calls return 500 with `SQLITE_BUSY` or just hang.

**Prevention:** Enable WAL mode (Write-Ahead Logging) and set a busy timeout in the Prisma schema:
```prisma
datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}
```
Then run a PRAGMA at connection time via Prisma's `$executeRaw`:
```typescript
// After prisma client creation
await prisma.$executeRaw`PRAGMA journal_mode=WAL;`
await prisma.$executeRaw`PRAGMA busy_timeout=5000;`
```
Or use a `previewFeatures` `tracing` approach or a connection initialization hook if available in your Prisma version.

**Detection:** Requests to non-chat routes return 500 while a chat stream is in progress. Logs show `SQLITE_BUSY` or `P2024` Prisma errors.

---

## Moderate Pitfalls

---

### Pitfall 7: Streaming Response Not Flushed — Buffering by Reverse Proxy or Next.js

**What goes wrong:** When running behind nginx, Caddy, or certain CDN/proxy configurations, the streaming response from the Next.js route handler gets buffered. The client sees no chunks until the entire response is buffered and flushed at once, or the request times out.

**Why it happens:** HTTP/1.1 chunked transfer encoding requires the proxy to not buffer. Many proxies default to buffering. Additionally, the `Content-Type` header matters: some proxies buffer `text/plain` but not `text/event-stream`.

**Prevention:**
- Set response headers explicitly:
  ```typescript
  headers: {
    'Content-Type': 'text/plain; charset=utf-8',
    'X-Accel-Buffering': 'no',      // disables nginx buffering
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  }
  ```
- If using SSE (Server-Sent Events) format, use `text/event-stream` — proxies rarely buffer this.
- For local development with `next dev`, buffering is not an issue. Test against actual deployment config.

**Detection:** Streaming works in `next dev` but not in production. Network tab in the browser shows the response arriving in a single chunk after a long wait.

---

### Pitfall 8: Chat History Grows Without Bound — Context Window Overflows in Long Sessions

**What goes wrong:** Every chat turn is saved to SQLite and re-sent to Gemini as the full conversation history. After 20–30 turns with detailed responses, the accumulated conversation history alone can exceed 10,000 tokens. Combined with the megatrend docs in the system prompt, a long session approaches the practical effective context limit.

**Why it happens:** Stateless API design requires the entire conversation history to be sent on each request. There is no server-side session memory in the Vertex AI API.

**Consequences:** Requests start failing with token limit errors, or early turns in the conversation get truncated, causing the model to "forget" earlier context.

**Prevention:**
1. Implement a sliding window: send only the last N turns (e.g., last 20 messages) plus the first 2 (which establish the student's topic and initial context).
2. Measure the token count of conversation history before sending; if it exceeds a threshold (e.g., 8,000 tokens), drop the oldest turns first.
3. Never truncate from the end — always drop from the middle of history, preserving the first 2 turns and last 10.

**Detection:** Monitor token usage per request. Log `usageMetadata.promptTokenCount` from Vertex AI responses.

---

### Pitfall 9: Prisma Migrations Fail Silently in Production — Database Schema Out of Sync

**What goes wrong:** `prisma migrate deploy` (the production command) silently skips migrations if the migration lock is stale or if the database file doesn't exist at the path specified in `DATABASE_URL`. The app starts, Prisma doesn't error on import, but queries fail at runtime with `no such table` errors.

**Why it happens:** `prisma migrate deploy` applies pending migrations but does not create the database file itself — the SQLite file must exist or must be created by the migrate command. If `DATABASE_URL` points to a path like `file:./prisma/dev.db` but the working directory at deployment time is different from development, the file is created in an unexpected location.

**Prevention:**
1. Always use an absolute path in production or a path relative to a known anchor:
   ```bash
   DATABASE_URL="file:/app/data/trend-mapper.db"
   ```
2. Run `prisma migrate deploy` as part of the startup script, not as a build step.
3. After migration, run a smoke query: `prisma.$queryRaw\`SELECT 1\`` — if it returns without error, the DB is ready.
4. Keep `prisma/migrations/` in version control. Never use `prisma db push` in production (it can silently drop columns).

**Detection:** Application starts without errors but first database query returns `PrismaClientKnownRequestError: no such table`.

---

### Pitfall 10: System Prompt + Megatrend Docs Included in `contents` Array Instead of `systemInstruction`

**What goes wrong:** The Vertex AI Gemini API has a distinct `systemInstruction` field separate from the `contents` array (conversation turns). Developers unfamiliar with this structure put the system prompt as the first `user` message in `contents`. This works but has two problems:
1. The system prompt competes with megatrend docs and conversation history for the context window in a less efficient way.
2. The model may treat the system instructions as something the user typed and respond to them conversationally.

**Why it happens:** OpenAI-style APIs use a `role: 'system'` message in the messages array. The Vertex AI API uses a separate top-level `systemInstruction` field. Developers porting from OpenAI patterns apply the wrong structure.

**Prevention:** Use the correct Vertex AI API structure:
```typescript
const request = {
  systemInstruction: {
    role: 'system',
    parts: [{ text: systemPrompt + '\n\n' + megatrendContext }]
  },
  contents: conversationHistory,  // only user/model turns here
  generationConfig: { ... }
}
```

**Detection:** Model occasionally references or responds to parts of the system prompt as if they were user messages. Conversation flow feels confused in early turns.

---

### Pitfall 11: `prisma generate` Not Run After Schema Changes — Stale Type Definitions

**What goes wrong:** After modifying `schema.prisma` (e.g., adding a `title` field to the `Project` model), the TypeScript types used throughout the application still reflect the old schema. The build may succeed because `@prisma/client` exports are cached. Runtime insertions fail with `Unknown field` errors from Prisma.

**Why it happens:** Prisma generates TypeScript types into `node_modules/@prisma/client` at `prisma generate` time. This is not automatic. Schema changes without a generate step leave stale types.

**Prevention:**
1. Add `prisma generate` to the `postinstall` script in `package.json`:
   ```json
   "scripts": {
     "postinstall": "prisma generate"
   }
   ```
2. Create a migration and run generate together: `prisma migrate dev --name add_title` automatically runs `prisma generate` after the migration.
3. Add `prisma generate` to the CI pipeline.

**Detection:** TypeScript autocomplete shows old fields. `Argument unknown: title` runtime errors from Prisma after schema changes.

---

### Pitfall 12: Vertex AI `GOOGLE_CLOUD_PROJECT` and `GOOGLE_CLOUD_LOCATION` Not Set — Wrong Default Region

**What goes wrong:** The `@google-cloud/vertexai` SDK requires `project` and `location` at client initialization. If omitted, it may attempt to autodiscover from the GCE metadata server (which doesn't exist locally) or throw an unclear initialization error. If hardcoded to the wrong region (e.g., `us-central1` vs `europe-west4`), quota errors appear in certain project configurations.

**Why it happens:** Developers initialize `new VertexAI({})` with no parameters expecting autodiscovery, or copy examples that hardcode `us-central1` without verifying their project's enabled region.

**Prevention:** Always explicitly provide project and location from environment variables:
```typescript
const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
})
```
And set in `.env.local`:
```bash
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
```
Verify the correct region with `gcloud ai models list --region=us-central1` — if Gemini models appear, that region is active for your project.

**Detection:** `Error: Unable to detect a Project ID in the current environment` on SDK initialization, or `404 Model not found` when the model string is correct but the region is wrong.

---

## Minor Pitfalls

---

### Pitfall 13: `next dev` Caches GET Route Handlers — API Responses Appear Stale

**What goes wrong:** Next.js 15 changed the default caching for GET route handlers from static (cached) to dynamic (uncached). However, in Next.js 14 (as used in this project), GET handlers may be cached if they don't use dynamic functions. A GET `/api/projects` route that doesn't read request headers or cookies may return a stale cached response.

**Prevention:** For any route that reads from SQLite (always dynamic), add:
```typescript
export const dynamic = 'force-dynamic'
```
Or use POST for all data-fetching operations that require fresh data (chat history retrieval, project listing in a client component).

---

### Pitfall 14: DOCX Extraction Produces Garbage — XML Tags in Context

**What goes wrong:** DOCX files are ZIP archives containing XML. Reading them with `fs.readFileSync` and passing the raw buffer to the model produces binary/XML garbage, not readable text. The model cannot process this and produces nonsense or errors.

**Prevention:** Use a proper DOCX-to-text extraction library at build time:
- `mammoth` (npm) — extracts clean plain text from DOCX, widely used
- `docx-parser` or `officeparser` — alternatives

Extract once at build/startup, not per request:
```typescript
// scripts/extract-docs.ts  (run once, output saved to lib/context/)
import mammoth from 'mammoth'
const result = await mammoth.extractRawText({ path: './docs/megatrends.docx' })
fs.writeFileSync('./lib/context/megatrends.txt', result.value)
```

---

### Pitfall 15: Missing `X-Content-Type-Options` on Streaming Route — Browser Sniffs MIME Type

**What goes wrong:** Browsers that sniff MIME types may interpret a `text/plain` streaming response as HTML and attempt to render it, breaking the incremental display. Specifically, Internet Explorer and some Edge configurations do this; modern Chrome does not, but the header is still good practice.

**Prevention:** Add `X-Content-Type-Options: nosniff` to streaming response headers. This is low-priority for an internal tool but costs nothing to add.

---

### Pitfall 16: Forgetting to `await params` in Next.js 15-style Route Handlers

**What goes wrong:** As noted in the Next.js changelog, from v15.0.0-RC onwards, `context.params` is a Promise and must be awaited. If this project is upgraded from 14 to 15, any route using `params` (e.g., `/api/projects/[id]/messages`) will break silently — `params.id` will be `undefined` rather than the actual ID.

**Prevention:** Write routes defensively even on Next.js 14:
```typescript
// Safe in both Next.js 14 and 15:
const { id } = await Promise.resolve(params)
```
Or simply document that a migration to `await params` is required on Next.js upgrade.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Setting up Vertex AI route | Edge runtime breaking SDK | Add `export const runtime = 'nodejs'` to all AI routes immediately |
| First streaming implementation | AsyncIterator not bridged correctly | Test with a minimal echo stream before adding megatrend context |
| Injecting megatrend docs | Raw DOCX binary sent as context | Extract to text in a setup script; measure tokens before wiring up |
| Prisma schema setup | `prisma generate` not in postinstall | Add to `package.json` `postinstall` before writing any Prisma queries |
| Local dev with hot reload | Multiple PrismaClient instances | Add global singleton pattern on Day 1; not retrofittable without disruption |
| Production deployment | ADC not found outside gcloud CLI context | Set `GOOGLE_APPLICATION_CREDENTIALS` in `.env.local`; use service account for prod |
| Long chat sessions | History overflowing context budget | Build sliding window into the chat API handler from the start |
| SQLite under load | Concurrent reads/writes blocking | Enable WAL mode and busy_timeout before first load test |

---

## Confidence Notes

| Claim | Confidence | Source |
|-------|------------|--------|
| Edge runtime breaks Vertex AI Node SDK | HIGH | Verified: Node.js SDK uses `fs` (confirmed); Edge runtime blocks `fs` (Next.js docs) |
| Vertex AI uses separate `systemInstruction` field | HIGH | Training data; consistent with Google AI SDK design; verify against current SDK docs |
| ADC credential lookup order | HIGH | Training data (google-auth-library is well-documented behavior, stable) |
| Gemini 1.5 Pro context window = 1M tokens | MEDIUM | Training data; verify current limits at cloud.google.com/vertex-ai |
| Practical per-request token quota limits | LOW | Varies by project/region/tier; verify in GCP console under Vertex AI quotas |
| Prisma global singleton pattern | HIGH | Official Prisma Next.js guide; well-established pattern |
| WAL mode syntax for Prisma SQLite | MEDIUM | Training data; `$executeRaw` PRAGMA approach is correct, verify Prisma version compatibility |
| Next.js 15 `params` async change | HIGH | Verified: documented in Next.js route.js version history (v15.0.0-RC) |

---

## Sources

- Next.js Route Handlers official docs (verified, March 2026): https://nextjs.org/docs/app/api-reference/file-conventions/route
- PROJECT.md — project constraints and stack decisions (read directly)
- FUND_II_Trend_Mapper_System_Prompt.txt — system prompt length and structure (read directly)
- Megatrend doc file sizes (measured directly): ~131KB compressed across 3 DOCX + 1 PDF
- google-auth-library ADC credential chain: training data (August 2025), HIGH confidence for well-established behavior
- Prisma Next.js best practices: training data + known official pattern
- Vertex AI Node.js SDK streaming API: training data (August 2025), MEDIUM confidence — verify against current SDK version
