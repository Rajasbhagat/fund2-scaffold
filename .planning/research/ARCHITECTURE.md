# Architecture Patterns

**Project:** FUND II Trend Mapper
**Researched:** 2026-03-21
**Confidence:** HIGH — based on Next.js 15/App Router official docs (verified), Vertex AI Node SDK training knowledge (MEDIUM), Prisma SQLite patterns (HIGH), gcloud auth behavior (HIGH)

---

## Recommended Architecture

A single Next.js 14+ App Router application. The server owns all Vertex AI calls — Route Handlers act as the API boundary. React Client Components handle the chat UI. SQLite via Prisma stores all persistent state. There is no separate backend process.

```
Browser (React)
    │  REST calls (fetch)
    ▼
Next.js Route Handlers  ←── runs in Node.js process
    │  @google-cloud/vertexai SDK
    ▼
Vertex AI Gemini API  (streaming)
    │
    ▼ (SSE / ReadableStream back to browser)
Browser (renders tokens as they arrive)

Prisma Client
    │
    ▼
SQLite file (prisma/dev.db)
```

---

## Directory / File Structure

```
fund2-trend-mapper/
├── app/
│   ├── layout.tsx                    # Root layout, global fonts/styles
│   ├── page.tsx                      # Dashboard — project list
│   ├── projects/
│   │   └── [projectId]/
│   │       └── page.tsx              # Chat view for a specific project
│   └── api/
│       ├── projects/
│       │   ├── route.ts              # GET /api/projects, POST /api/projects
│       │   └── [projectId]/
│       │       └── route.ts          # GET, PATCH, DELETE /api/projects/:id
│       └── chat/
│           └── [projectId]/
│               └── route.ts          # POST /api/chat/:projectId  (streaming)
│
├── components/
│   ├── ProjectCard.tsx
│   ├── ProjectForm.tsx               # Create/rename modal
│   ├── ChatWindow.tsx                # Client Component — renders messages + stream
│   ├── ChatInput.tsx                 # Client Component — textarea + send
│   └── MessageBubble.tsx
│
├── lib/
│   ├── prisma.ts                     # Prisma singleton (prevents hot-reload duplication)
│   ├── vertexai.ts                   # Vertex AI client singleton + chat builder
│   ├── context.ts                    # Loads system prompt + megatrend docs at startup
│   └── types.ts                      # Shared TypeScript interfaces
│
├── prisma/
│   ├── schema.prisma
│   └── dev.db                        # SQLite file (gitignored)
│
├── public/
│   └── (static assets)
│
├── Trend Mapper/                     # Source docs — read at server startup
│   ├── FUND_II_Trend_Mapper_System_Prompt.txt
│   └── MEGATRENDS Docs for TrendMapper/
│       ├── Deep Research Report ChaqtGPT.docx
│       ├── Global_Megatrends_Impact_Impulse_Matrix_2025-2050 (Claude).docx
│       ├── Spotting_Big_Trends_Megatrends_Handout.pdf
│       └── The Great Fragmentation GEMINI Deep Research.docx
│
├── .env.local                        # GOOGLE_CLOUD_PROJECT, MODEL_ID
├── next.config.ts
└── package.json
```

**Key decisions:**
- Route Handlers (`app/api/`) not Server Actions for chat — streaming responses require a Route Handler; Server Actions cannot return a `ReadableStream`.
- Server Actions are acceptable for project CRUD (non-streaming mutations) but Route Handlers keep everything consistent and easier to test with curl.
- `lib/context.ts` reads and caches the megatrend docs once at module load time (Node.js module cache). No hot-reload risk in production.

---

## Data Model

### Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

model Project {
  id        String    @id @default(cuid())
  name      String
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  messages  Message[]
}

model Message {
  id        String   @id @default(cuid())
  projectId String
  role      String   // "user" | "model"
  content   String
  createdAt DateTime @default(now())

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
}
```

**Design notes:**
- `role` matches Vertex AI's `Content.role` field values (`"user"` and `"model"`) exactly — no translation needed when reconstructing chat history.
- `onDelete: Cascade` means deleting a project removes all its messages automatically.
- `@@index([projectId, createdAt])` — the only query pattern is "all messages for project X ordered by time"; this covers it.
- No `userId` column — MVP has no auth, single shared workspace.
- `content` stores plain text. Do not store the injected system prompt or megatrend docs in the DB — they are injected at request time from the file system.

### SQL Table Equivalents

```sql
-- Project
id        TEXT PRIMARY KEY      -- cuid, e.g. "clxyz..."
name      TEXT NOT NULL
createdAt DATETIME DEFAULT now()
updatedAt DATETIME

-- Message
id        TEXT PRIMARY KEY
projectId TEXT NOT NULL REFERENCES Project(id) ON DELETE CASCADE
role      TEXT NOT NULL CHECK(role IN ('user', 'model'))
content   TEXT NOT NULL
createdAt DATETIME DEFAULT now()
```

---

## API Route Design

### Projects API

| Method | Path | Body | Response | Purpose |
|--------|------|------|----------|---------|
| GET | `/api/projects` | — | `Project[]` | List all projects |
| POST | `/api/projects` | `{ name: string }` | `Project` | Create project |
| GET | `/api/projects/:id` | — | `Project + Message[]` | Load project with history |
| PATCH | `/api/projects/:id` | `{ name: string }` | `Project` | Rename project |
| DELETE | `/api/projects/:id` | — | `{ ok: true }` | Delete project + messages |

### Chat API

| Method | Path | Body | Response | Purpose |
|--------|------|------|----------|---------|
| POST | `/api/chat/:projectId` | `{ message: string }` | `ReadableStream` (SSE text) | Send message, stream reply |

The chat endpoint does NOT return JSON. It returns a streaming `text/plain` response where chunks are raw UTF-8 text tokens as they arrive from Vertex AI.

```typescript
// app/api/chat/[projectId]/route.ts (outline)
export const runtime = 'nodejs'  // Required — Edge runtime cannot use gcloud auth

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params
  const { message } = await request.json()

  // 1. Load chat history from DB
  // 2. Persist the new user message
  // 3. Build Vertex AI chat with system prompt + megatrend context + history
  // 4. Call generateContentStream
  // 5. Bridge the async iterator into a ReadableStream
  // 6. After stream ends, persist the completed assistant message
  // 7. Return the ReadableStream as the HTTP response

  const stream = new ReadableStream({ ... })
  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  })
}
```

---

## Streaming: Next.js App Router + Vertex AI

**Confirmed approach (HIGH confidence):** Next.js Route Handlers support returning a `ReadableStream` directly via `new Response(stream)`. The Vertex AI Node SDK's `generateContentStream` returns an async iterable. Bridge them with an iterator-to-stream adapter.

### Pattern: Iterator → ReadableStream

```typescript
// lib/vertexai.ts
import { VertexAI } from '@google-cloud/vertexai'
import { getSystemPromptWithContext } from './context'

// Singleton — one client per Node process
const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: 'us-central1',
})

export function buildGenerativeModel() {
  return vertexAI.getGenerativeModel({
    model: process.env.VERTEX_MODEL_ID ?? 'gemini-1.5-pro-002',
    // Web search grounding tool is configured here if needed
  })
}

export async function streamChatResponse(
  history: Array<{ role: string; parts: Array<{ text: string }> }>,
  userMessage: string
): Promise<ReadableStream<Uint8Array>> {
  const model = buildGenerativeModel()
  const systemPrompt = getSystemPromptWithContext() // cached, see Context section

  const chat = model.startChat({
    history,
    systemInstruction: { parts: [{ text: systemPrompt }] },
  })

  const result = await chat.sendMessageStream(userMessage)
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      for await (const chunk of result.stream) {
        const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
        if (text) {
          controller.enqueue(encoder.encode(text))
        }
      }
      controller.close()
    },
  })
}
```

### Pattern: Persist after stream completes

The stream must fully finish before the completed assistant message can be saved. Use a separate mechanism to do this — do not try to save inside the ReadableStream `start()` callback in the same response.

**Recommended approach:** After the stream is returned to the client, the Route Handler wraps the stream in a transform that buffers the full response text in a closure, then calls `prisma.message.create()` when the stream closes.

```typescript
// In the route handler:
let fullResponse = ''

const persistingStream = new ReadableStream({
  async start(controller) {
    for await (const chunk of result.stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      if (text) {
        fullResponse += text
        controller.enqueue(encoder.encode(text))
      }
    }
    // Stream closed — persist now
    await prisma.message.create({
      data: { projectId, role: 'model', content: fullResponse }
    })
    controller.close()
  },
})
```

**Why this works:** Next.js Route Handlers on the Node.js runtime keep the server-side execution alive until the stream controller closes, even after the first byte is sent to the client.

### Client-side consumption

```typescript
// components/ChatWindow.tsx (simplified)
'use client'

async function sendMessage(projectId: string, message: string) {
  const res = await fetch(`/api/chat/${projectId}`, {
    method: 'POST',
    body: JSON.stringify({ message }),
    headers: { 'Content-Type': 'application/json' },
  })

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let assistantText = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    assistantText += decoder.decode(value, { stream: true })
    setStreamingMessage(assistantText) // React state update per chunk
  }
}
```

**Important:** Set `export const runtime = 'nodejs'` in the chat Route Handler. The Edge runtime does not support `@google-cloud/vertexai` or the gcloud credential chain.

---

## Context Management: System Prompt + Megatrend Docs

### Strategy: Full-context injection (not RAG)

For MVP, the entire system prompt plus all three megatrend documents are concatenated and passed as the `systemInstruction` in every chat request. This is the right call because:
- The megatrend docs are fixed and finite (estimated 30,000–60,000 tokens total across three docs)
- Gemini 1.5 Pro supports a 1M token context window; 1.5 Flash supports 1M as well
- RAG adds significant complexity with marginal benefit when the corpus is small and static

**Token budget estimate:**
- System prompt: ~2,000 tokens
- Three megatrend docs (docx/pdf, extracted text): ~30,000–50,000 tokens estimated
- Chat history (rolling 20 turns): ~5,000–10,000 tokens
- User message: ~200 tokens
- **Total per request: ~40,000–65,000 tokens** — well within Gemini 1.5 Pro's limit

### Loading strategy

```typescript
// lib/context.ts
import fs from 'fs'
import path from 'path'

// Loaded once at module import time — cached by Node module system
// In development, next.config.ts can configure serverComponentsExternalPackages
// to avoid re-evaluation, or use a simple global singleton

let _cachedContext: string | null = null

export function getSystemPromptWithContext(): string {
  if (_cachedContext) return _cachedContext

  const trendMapperDir = path.join(process.cwd(), 'Trend Mapper')

  // System prompt — plain text, read directly
  const systemPrompt = fs.readFileSync(
    path.join(trendMapperDir, 'FUND_II_Trend_Mapper_System_Prompt.txt'),
    'utf-8'
  )

  // Megatrend docs — must be pre-extracted to .txt or .md files
  // DOCX and PDF cannot be read with fs.readFileSync; a build-time extraction step is needed
  const docsDir = path.join(trendMapperDir, 'MEGATRENDS Docs for TrendMapper')
  const extractedDocs = fs.readdirSync(docsDir)
    .filter(f => f.endsWith('.txt') || f.endsWith('.md'))
    .map(f => fs.readFileSync(path.join(docsDir, f), 'utf-8'))
    .join('\n\n---\n\n')

  _cachedContext = `${systemPrompt}\n\n[MEGATREND KNOWLEDGE BASE]\n\n${extractedDocs}`
  return _cachedContext
}
```

**Critical: Document extraction.** The megatrend docs are `.docx` and `.pdf` files. These cannot be passed as raw bytes to Vertex AI's text model via the Node SDK in the same way images can. They must be pre-extracted to plain text. Two options:

1. **One-time manual extraction (MVP):** Run a script using `mammoth` (for .docx) and `pdf-parse` (for .pdf) to produce `.txt` files in the same directory. Commit the `.txt` files. The `context.ts` module reads them at startup.

2. **Build-step extraction:** Add a `prebuild` npm script that runs extraction. Regenerate when docs change.

**Recommended for MVP: Option 1.** Extract once, commit the `.txt` files, read them at startup.

```bash
# One-time extraction script (scripts/extract-docs.ts)
# npm install mammoth pdf-parse
# npx ts-node scripts/extract-docs.ts
```

### Chat history window

To prevent unbounded token growth in long projects, apply a rolling window:

```typescript
// lib/vertexai.ts
const MAX_HISTORY_MESSAGES = 40  // 20 turns (user + model pairs)

function buildHistory(messages: Message[]) {
  // Take the most recent N messages, always include full history from start
  // for short conversations; truncate oldest first for long ones
  const recent = messages.slice(-MAX_HISTORY_MESSAGES)
  return recent.map(m => ({
    role: m.role,
    parts: [{ text: m.content }],
  }))
}
```

Vertex AI's `startChat()` takes a `history` array of `Content` objects. The format must be alternating `user`/`model` turns. Load messages from DB ordered by `createdAt ASC`, exclude the new user message (it is passed to `sendMessageStream` separately).

---

## gcloud CLI Auth Server-Side

### How it works (HIGH confidence)

The `@google-cloud/vertexai` Node SDK uses Application Default Credentials (ADC). ADC resolves credentials in this order:

1. `GOOGLE_APPLICATION_CREDENTIALS` env variable (path to a service account JSON key)
2. `gcloud auth application-default login` — stores credentials in `~/.config/gcloud/application_default_credentials.json`
3. Metadata server (when running on GCP — Cloud Run, GCE, etc.)

For local development where you have run `gcloud auth application-default login`, the SDK automatically finds the credentials file. No environment variable is required.

### Local development setup

```bash
# One-time setup — already done per project context
gcloud auth application-default login

# Verify credentials are available
gcloud auth application-default print-access-token
```

The Next.js Node.js process (running as your user on localhost) inherits the same home directory and can read `~/.config/gcloud/application_default_credentials.json`.

### .env.local required variables

```bash
# .env.local
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
VERTEX_MODEL_ID=gemini-1.5-pro-002
# GOOGLE_APPLICATION_CREDENTIALS is NOT needed for local dev with gcloud ADC
```

### Production deployment

For any non-GCP host (e.g., a VPS, DigitalOcean, EC2):

1. Create a service account with the `Vertex AI User` role in GCP IAM
2. Download the JSON key file
3. Set `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` as an environment variable in the deployment environment
4. Do NOT commit the key file to git

For GCP-native deployment (Cloud Run, App Engine): no key needed — assign the service account to the Cloud Run service and ADC resolves via the metadata server automatically.

### Why Route Handlers and not Edge functions

The `@google-cloud/vertexai` SDK requires Node.js APIs (file system access for credentials, Node crypto for signing). It cannot run in the Edge runtime. Always export `runtime = 'nodejs'` from any Route Handler that calls Vertex AI.

---

## Component Boundaries

| Component | Type | Responsibility | Communicates With |
|-----------|------|---------------|-------------------|
| `app/page.tsx` | Server Component | Renders project list (fetches from DB directly via Prisma) | Prisma, `ProjectCard` |
| `app/projects/[id]/page.tsx` | Server Component | Initial render with project + message history | Prisma, `ChatWindow` |
| `ChatWindow.tsx` | Client Component | Manages streaming state, message list, scroll | `/api/chat/:id` via fetch |
| `ChatInput.tsx` | Client Component | Textarea, submit button, disabled state during stream | `ChatWindow` (callback) |
| `MessageBubble.tsx` | Client Component | Renders markdown in messages | — |
| `/api/projects/route.ts` | Route Handler | CRUD for projects | Prisma |
| `/api/chat/[id]/route.ts` | Route Handler (Node) | Streaming chat with Vertex AI | Prisma, `lib/vertexai.ts`, `lib/context.ts` |
| `lib/prisma.ts` | Singleton module | One PrismaClient instance per process | All DB-touching modules |
| `lib/vertexai.ts` | Module | VertexAI client, `streamChatResponse()` | `@google-cloud/vertexai` |
| `lib/context.ts` | Module | Load and cache system prompt + megatrend text | File system (once) |

### Data Flow: New Chat Message

```
User types message → ChatInput.tsx (client)
    │  POST /api/chat/:projectId { message }
    ▼
Route Handler: app/api/chat/[projectId]/route.ts (server, Node.js)
    │  prisma.message.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } })
    ▼
SQLite (load history)
    │
    ▼ history array
Route Handler
    │  prisma.message.create({ data: { role: 'user', content: message } })
    ▼
SQLite (persist user message)
    │
    ▼
lib/vertexai.ts: streamChatResponse(history, userMessage)
    │  vertexAI client → Vertex AI API (generateContentStream)
    ▼
Vertex AI Gemini (streaming)
    │  async iterator of chunks
    ▼
ReadableStream (bridging iterator → Web Stream API)
    │  tokens enqueued as they arrive, full response buffered in closure
    ▼
new Response(stream) returned from Route Handler
    │  HTTP response with streaming body
    ▼
ChatWindow.tsx: reader.read() loop
    │  setStreamingMessage(accumulated) on each chunk
    ▼
React renders partial message
    │  stream closes
    ▼
Route Handler: prisma.message.create({ role: 'model', content: fullResponse })
SQLite (persist complete assistant message)
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Server Actions for streaming

**What:** Using `'use server'` functions for the chat submit handler.
**Why bad:** Server Actions return serializable values or throw. They cannot return a `ReadableStream`. Attempting to stream from a Server Action requires a workaround that adds complexity without benefit.
**Instead:** Use a Route Handler (`app/api/chat/[projectId]/route.ts`) with `runtime = 'nodejs'`.

### Anti-Pattern 2: Edge runtime for Vertex AI calls

**What:** Adding `export const runtime = 'edge'` to the chat Route Handler.
**Why bad:** The Edge runtime does not have access to the Node.js file system (`fs`), which the gcloud credential resolution requires. The SDK will fail at credential lookup.
**Instead:** Always use `runtime = 'nodejs'` (the default) for any Route Handler calling Vertex AI.

### Anti-Pattern 3: Instantiating PrismaClient in every module

**What:** `new PrismaClient()` in each file that needs DB access.
**Why bad:** In Next.js development with hot reload, each module re-evaluation creates a new Prisma client, quickly exhausting SQLite connections and emitting warnings.
**Instead:** Use the singleton pattern in `lib/prisma.ts`:

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ['error'] })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

### Anti-Pattern 4: Injecting raw .docx / .pdf bytes as context

**What:** Passing the binary content of `.docx` files directly into the Vertex AI text prompt.
**Why bad:** Binary data is not valid UTF-8 text and will produce garbled or error results. Gemini's multimodal document understanding via the Node SDK requires the File API or inline base64 for supported formats — `.docx` is not a supported inline format.
**Instead:** Pre-extract megatrend docs to plain text with `mammoth` / `pdf-parse` and pass clean UTF-8 text as context.

### Anti-Pattern 5: Storing system prompt + docs in the database

**What:** Saving the full system prompt or megatrend text in the `Message` table on every turn to reconstruct context.
**Why bad:** Massively inflates DB size; the system prompt is static per-deployment.
**Instead:** Inject from the file system via `lib/context.ts` at request time. Only store actual user/model conversation turns in the DB.

### Anti-Pattern 6: Unbounded chat history in the Vertex AI request

**What:** Loading all messages for a project (potentially hundreds) into the history array.
**Why bad:** As a project grows, history can exceed the context window or produce excessively high token costs.
**Instead:** Apply a rolling window (`slice(-40)`) when building the history array. For this app, 40 messages (20 turns) is generous while staying well under the 1M token limit.

---

## Scalability Considerations

| Concern | At 10 users (MVP) | At 100 users | At 1,000+ users |
|---------|-------------------|--------------|-----------------|
| Database | SQLite fine | SQLite fine (read-mostly, low concurrency) | Migrate to PostgreSQL |
| Credential management | gcloud ADC (local) or SA key | Same | Consider Workload Identity if on GCP |
| Context injection | Read files at startup, cache in memory | Same | Same (docs don't change) |
| Chat history | Full load from DB | Full load fine for SQLite | Add pagination / window at DB layer |
| Next.js deployment | `next dev` or `next start` on any VPS | PM2 + reverse proxy | Cloud Run or Vercel |
| Streaming connections | Handled by Node.js natively | Same | Same — each stream is short-lived |

---

## Sources

- Next.js Route Handlers official docs (verified 2026-03-21): https://nextjs.org/docs/app/api-reference/file-conventions/route — streaming pattern confirmed, `runtime = 'nodejs'` requirement confirmed
- Next.js streaming guide: iterator-to-ReadableStream pattern confirmed in official docs
- `@google-cloud/vertexai` Node SDK — `startChat()`, `sendMessageStream()`, `systemInstruction` field (HIGH confidence from training knowledge, SDK stable since v1.0)
- Google Cloud ADC documentation — credential resolution order (HIGH confidence, stable behavior)
- Prisma SQLite quickstart — schema syntax, singleton pattern (HIGH confidence)
- System prompt character count analysis: `FUND_II_Trend_Mapper_System_Prompt.txt` is ~5,000 words / ~7,000 tokens; megatrend docs estimated 30,000–50,000 tokens total
