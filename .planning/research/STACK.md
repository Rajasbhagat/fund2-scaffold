# Technology Stack

**Project:** FUND II Trend Mapper
**Researched:** 2026-03-21
**Confidence:** MEDIUM-HIGH (based on training knowledge through August 2025; web verification unavailable in this session — version pins should be confirmed against npm before first install)

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 14.2.x | Full-stack framework | App Router enables server components, Route Handlers, and first-class streaming. API routes keep Vertex AI credentials server-side. Single repo for UI + backend. |
| React | 18.3.x | UI rendering | Ships with Next.js 14. Concurrent features (Suspense, transitions) pair well with streaming chat. |
| TypeScript | 5.4.x | Type safety | Prisma generates typed client; Vertex AI SDK and AI SDK both ship types. Catches schema/API mismatches at compile time rather than runtime. |
| Node.js | 20 LTS | Runtime | Required for `@google-cloud/vertexai` — the SDK uses Google Auth Library which is Node-only (no edge runtime support). Pin to 20 LTS for stability. |

**Why Next.js 14 not 15:** The project constraint specifies 14. Next.js 15 introduced breaking changes to caching defaults and async params. 14.2.x is battle-tested and fully supported. If upgrading to 15 later, the main change is `params` becoming async in Route Handlers.

---

### LLM Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@google-cloud/vertexai` | `^1.9.0` | Direct Vertex AI Gemini SDK | The official Google Node.js SDK for Vertex AI. Handles Application Default Credentials (ADC) automatically — `gcloud auth application-default login` is sufficient. Supports streaming via `generateContentStream`. No API key needed; uses the ambient gcloud identity. |
| Vercel AI SDK (`ai`) | `^3.4.x` | Streaming helpers + UI hooks | Provides `useChat` React hook for the frontend and `StreamingTextResponse` / `streamText` for Route Handlers. Dramatically reduces boilerplate for streaming chat UIs. |
| `@ai-sdk/google-vertex` | `^0.0.x` | AI SDK ↔ Vertex AI bridge | Wraps `@google-cloud/vertexai` so you can use `streamText` from the AI SDK with the Vertex AI provider. Handles the credential handoff. **See note below.** |

**Critical note on SDK choice — two valid paths:**

**Path A (Recommended): Vercel AI SDK + @ai-sdk/google-vertex**
```typescript
// app/api/chat/route.ts
import { streamText } from 'ai'
import { createVertex } from '@ai-sdk/google-vertex'

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: 'us-central1',
})

export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = await streamText({
    model: vertex('gemini-1.5-pro'),
    system: SYSTEM_PROMPT,
    messages,
    maxTokens: 8192,
  })

  return result.toAIStreamResponse()
}
```
The `useChat` hook on the frontend handles streaming, message state, loading states, and error handling. This is roughly 80% less code than rolling your own.

**Path B (Fallback): @google-cloud/vertexai directly**
Use this if `@ai-sdk/google-vertex` causes auth issues with ADC in your environment, or if you need fine-grained control over Vertex AI features (grounding, safety settings, system instruction format).

```typescript
import { VertexAI } from '@google-cloud/vertexai'

const vertexAI = new VertexAI({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: 'us-central1',
})

const model = vertexAI.getGenerativeModel({
  model: 'gemini-1.5-pro',
  systemInstruction: {
    role: 'system',
    parts: [{ text: SYSTEM_PROMPT }],
  },
})

// Streaming
const streamingResp = await model.generateContentStream({ contents: messages })
const stream = new ReadableStream({
  async start(controller) {
    for await (const chunk of streamingResp.stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      controller.enqueue(new TextEncoder().encode(text))
    }
    controller.close()
  },
})

return new Response(stream, {
  headers: { 'Content-Type': 'text/plain; charset=utf-8' },
})
```

**Recommendation:** Start with Path A (AI SDK). If ADC fails in the @ai-sdk/google-vertex wrapper, fall back to Path B. Both are production-viable. Do NOT use `@google/generative-ai` (Gemini Developer API) — that uses API keys, not ADC, and is not the Vertex AI product.

---

### Database Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Prisma | `^5.16.x` | ORM + schema management | Type-safe queries, migration system, and SQLite support. Auto-generates a client from your schema. The only ORM with first-class SQLite support AND full TypeScript types. |
| `@prisma/client` | `^5.16.x` (matches Prisma CLI) | Generated DB client | Ships with Prisma; version must match the CLI exactly. |
| SQLite (via `better-sqlite3`) | bundled with Prisma | Database engine | Prisma uses `better-sqlite3` under the hood for SQLite. Zero infrastructure: one file on disk. Sufficient for a single-workspace MVP with ~50 concurrent users max. |

**Prisma Schema for Chat History:**

```prisma
// prisma/schema.prisma
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
  role      String   // "user" | "assistant"
  content   String
  createdAt DateTime @default(now())

  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
}
```

**Why this schema:**
- `onDelete: Cascade` on Message means deleting a project deletes all its messages — no orphan records
- Composite index on `[projectId, createdAt]` makes "fetch all messages for project, ordered by time" O(log n) instead of O(n)
- `role` as String (not enum) keeps SQLite migrations simpler; validate at the application layer
- `cuid()` over `uuid()` — shorter, URL-friendly, monotonically increasing (better for ordering)

**Prisma + Next.js gotcha — singleton pattern required:**

```typescript
// lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

Without this, Next.js hot-reload in development spawns a new PrismaClient on every file change, exhausting SQLite's connection limit.

---

### Frontend UI

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Tailwind CSS | `^3.4.x` | Styling | Zero-config for Next.js. Utility-first keeps the component file self-contained. No CSS modules or styled-components needed for this scope. |
| shadcn/ui | latest | Component primitives | Not a package — it's a CLI that copies unstyled Radix UI components into your codebase. You own the code. Use for: dialogs (project rename/delete), scroll areas (chat window), inputs, buttons. Avoids building accessible components from scratch. |
| `ai` (Vercel AI SDK, client) | `^3.4.x` | `useChat` hook | The `useChat` hook manages message array, streaming state, input state, and submission. Replaces ~200 lines of manual state management. Works with the server-side `toAIStreamResponse()` call. |

**Why NOT a full component library (MUI, Chakra):** This is a focused internal tool. Heavy component libraries add 300-500KB to the bundle and require theme customization. shadcn/ui + Tailwind gives full control at zero runtime cost.

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `zod` | `^3.23.x` | Runtime validation | Validate API request bodies (projectId, message content) before touching the DB. Required — no auth means no trust of any input. |
| `clsx` + `tailwind-merge` | `^2.x` / `^2.x` | Conditional class names | Standard Tailwind utility pairing. Use `cn()` helper (shadcn convention) for conditional styling. |
| `@vercel/blob` or `fs` | — | Megatrend doc storage | The three megatrend docs live on disk as extracted text files. No library needed — `fs.readFileSync` in a server component or Route Handler is sufficient. Only reach for blob storage if deploying to a serverless environment without persistent disk. |
| `lucide-react` | `^0.400.x` | Icons | Ships with shadcn/ui conventions. Consistent icon set. |

---

### Document Context Strategy

The system prompt + megatrend docs are loaded at server startup and injected into every chat request. No vector DB, no RAG pipeline.

```typescript
// lib/context.ts
import fs from 'fs'
import path from 'path'

// Load once at module initialization (server-side only)
const MEGATREND_DOCS = [
  'Global_Megatrends_Impact_Impulse_Matrix.txt',
  'The_Great_Fragmentation.txt',
  'Deep_Research_Report_Megatrends.txt',
].map(filename =>
  fs.readFileSync(
    path.join(process.cwd(), 'content', 'megatrends', filename),
    'utf-8'
  )
).join('\n\n---\n\n')

export const FULL_SYSTEM_CONTEXT = `${SYSTEM_PROMPT}\n\n[MEGATREND KNOWLEDGE BASE]\n\n${MEGATREND_DOCS}`
```

**Pre-processing required:** The existing docs are `.docx` and `.pdf`. Before the first implementation phase, extract them to `.txt` files using `mammoth` (for `.docx`) or `pdf-parse` (for `.pdf`). Do this extraction once as a build-time step, commit the `.txt` outputs to the repo, and don't run extraction on every server start.

```bash
# One-time extraction (not a runtime dependency)
npx mammoth "Trend Mapper/MEGATRENDS Docs for TrendMapper/file.docx" --output content/megatrends/file.txt
```

**Token budget awareness:** Gemini 1.5 Pro has a 1M token context window. The three docs + system prompt will likely be 10,000–30,000 tokens. This is a rounding error. No chunking or summarization needed.

---

### Development Tooling

| Tool | Version | Purpose | Why |
|------|---------|---------|-----|
| ESLint | `^8.x` (ships with Next.js) | Linting | Use Next.js defaults. Add `plugin:@typescript-eslint/recommended`. |
| Prettier | `^3.x` | Formatting | Pair with `prettier-plugin-tailwindcss` to auto-sort Tailwind classes. |
| `tsx` | `^4.x` | Run TypeScript scripts | For one-off scripts (e.g., doc extraction). No need to compile to JS first. |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| LLM SDK | `@ai-sdk/google-vertex` + `ai` | `@google-cloud/vertexai` directly | Direct SDK works but requires 3x more boilerplate for streaming. AI SDK wraps it with `useChat` + `streamText` integration. Use direct SDK only if auth issues arise. |
| LLM SDK | Vertex AI | `@google/generative-ai` (Gemini API) | Different product. Uses API keys, not ADC. Would require managing a separate secret. Project uses Vertex AI. |
| Database | SQLite via Prisma | PostgreSQL (Supabase/Neon) | No cloud infrastructure needed for MVP. SQLite is sufficient for a single-workspace tool used by one cohort of ~40 MBA students. Prisma makes migration to Postgres trivial later — just change the `provider`. |
| Database | SQLite via Prisma | Drizzle ORM | Drizzle is excellent but has less mature migration tooling than Prisma 5. Prisma's `db push` + `migrate` workflow is faster for MVP iteration. Switch to Drizzle in v2 if bundle size becomes a concern (Prisma client is ~500KB). |
| Styling | Tailwind + shadcn/ui | MUI / Chakra UI | Full component libraries are overkill for an internal tool. They add bundle weight and require theme overriding. Tailwind + shadcn gives full control with zero runtime overhead. |
| Styling | Tailwind + shadcn/ui | CSS Modules | Viable but slower — no component library to pull from. shadcn/ui's copy-paste model is faster for chat UI components. |
| Streaming | AI SDK `toAIStreamResponse()` | Manual `ReadableStream` | Manual streaming works (see Path B above) but requires writing your own text encoding, error handling, and client-side parsing. AI SDK's `useChat` hook handles all of this. |
| Document context | Flat file injection | Vector DB + RAG (pgvector, Pinecone) | The megatrend corpus is small (3 docs, ~50 pages total) and static. RAG adds significant infrastructure complexity for zero benefit at this scale. Gemini 1.5 Pro's 1M token window makes it unnecessary. |

---

## Installation

```bash
# Create Next.js 14 app
npx create-next-app@14 fund2-trend-mapper --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*"

cd fund2-trend-mapper

# Core runtime dependencies
npm install @google-cloud/vertexai @ai-sdk/google-vertex ai zod

# Database
npm install prisma @prisma/client
npx prisma init --datasource-provider sqlite

# UI
npm install clsx tailwind-merge lucide-react
npx shadcn-ui@latest init
npx shadcn-ui@latest add button input scroll-area dialog

# Dev tools
npm install -D prettier prettier-plugin-tailwindcss tsx
```

**Environment variables (`.env.local`):**
```env
GOOGLE_CLOUD_PROJECT=your-gcp-project-id
GOOGLE_CLOUD_LOCATION=us-central1
DATABASE_URL="file:./prisma/dev.db"
```

**Note on ADC:** No `GOOGLE_APPLICATION_CREDENTIALS` needed if `gcloud auth application-default login` has been run. The SDK picks up the ambient credential automatically. In CI/CD or production, use a Service Account key or Workload Identity.

---

## Streaming Architecture in Next.js App Router

The streaming flow for a chat message:

```
User types → useChat (client) → POST /api/chat → Route Handler
→ streamText(vertex model) → toAIStreamResponse()
→ chunked HTTP response → useChat streams tokens into message array
→ React re-renders incrementally
```

**Route Handler pattern:**
```typescript
// app/api/chat/route.ts
import { streamText } from 'ai'
import { createVertex } from '@ai-sdk/google-vertex'
import { prisma } from '@/lib/prisma'
import { FULL_SYSTEM_CONTEXT } from '@/lib/context'
import { z } from 'zod'

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT!,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
})

const RequestSchema = z.object({
  projectId: z.string().cuid(),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().min(1).max(10000),
  })),
})

export async function POST(req: Request) {
  const body = await req.json()
  const { projectId, messages } = RequestSchema.parse(body)

  // Persist the user's message before streaming
  const lastUserMessage = messages[messages.length - 1]
  if (lastUserMessage.role === 'user') {
    await prisma.message.create({
      data: { projectId, role: 'user', content: lastUserMessage.content },
    })
  }

  const result = await streamText({
    model: vertex('gemini-1.5-pro'),
    system: FULL_SYSTEM_CONTEXT,
    messages,
    maxTokens: 4096,
    onFinish: async ({ text }) => {
      // Persist the assistant's complete response after streaming finishes
      await prisma.message.create({
        data: { projectId, role: 'assistant', content: text },
      })
    },
  })

  return result.toAIStreamResponse()
}
```

**Key patterns:**
- Persist the user message BEFORE streaming (so it's saved even if the user closes the tab mid-stream)
- Persist the assistant message in `onFinish` callback (fires after full response is received)
- Validate all inputs with Zod before touching the DB or the LLM
- `system` parameter injects the full context (system prompt + megatrend docs) on every request — stateless from Vertex AI's perspective

**Client-side `useChat` wiring:**
```typescript
// components/ChatInterface.tsx
'use client'
import { useChat } from 'ai/react'

export function ChatInterface({ projectId }: { projectId: string }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } = useChat({
    api: '/api/chat',
    body: { projectId },        // sent on every request
    initialMessages: [],        // load from DB separately via server component
  })
  // ...
}
```

---

## What NOT to Use

| Technology | Reason to Avoid |
|------------|-----------------|
| `@google/generative-ai` | This is the Gemini Developer API (API key auth). Project uses Vertex AI (ADC/service account auth). Mixing them causes auth confusion. |
| Edge Runtime (`export const runtime = 'edge'`) | `@google-cloud/vertexai` uses Google Auth Library which is Node.js-only. The Edge Runtime blocks Node APIs. Keep all AI routes as Node.js Route Handlers. |
| Server Actions for chat streaming | Next.js Server Actions don't support streaming responses as of 14.x. Use Route Handlers (`app/api/`) for the streaming chat endpoint. Server Actions are fine for non-streaming mutations (create project, rename, delete). |
| `getServerSideProps` / `pages/` router | The project uses App Router. Do not mix the two routing systems. |
| React Context for chat history | Chat history lives in the database. Don't duplicate it in React Context — this creates sync bugs. Load from DB on page mount, stream new messages into local state via `useChat`. |
| Vector database (Pinecone, Weaviate, pgvector) | RAG is unnecessary at this doc corpus size with Gemini 1.5 Pro's 1M context window. Adds infrastructure complexity with zero benefit. |
| Socket.io / WebSockets | HTTP streaming (chunked transfer) is sufficient for chat. WebSockets add complexity without benefit for a single-agent, request-response interaction pattern. |

---

## Sources

- Vercel AI SDK documentation (ai.sdk.vercel.ai) — HIGH confidence for `useChat`, `streamText`, `toAIStreamResponse` patterns as of SDK v3
- `@google-cloud/vertexai` GitHub repository and npm README — HIGH confidence for `VertexAI` constructor, `generateContentStream`, ADC credential handling
- Next.js 14 App Router documentation — HIGH confidence for Route Handler patterns, streaming, and the `onFinish` callback in AI SDK
- Prisma documentation — HIGH confidence for SQLite provider, schema syntax, singleton pattern, and `@default(cuid())`
- Training knowledge cutoff: August 2025. Version numbers should be verified against npm before first install (`npm show [package] version`).

**Versions to verify before install:**
- `@ai-sdk/google-vertex` — was in early/active development as of August 2025; confirm latest stable
- `@google-cloud/vertexai` — confirm 1.x is still current, not superseded by a 2.x release
- `ai` (Vercel AI SDK) — v3 vs v4 distinction matters; confirm `useChat` API is unchanged
