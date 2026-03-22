# Stack Research

**Domain:** AI-powered slide generation from agent conversations (v2.1 milestone additions)
**Researched:** 2026-03-22
**Confidence:** HIGH (pptxgenjs official docs verified; AI SDK 6 migration guide verified)

> **Scope note:** This file covers ONLY the new stack additions for milestone v2.1 (slide generation).
> The existing validated stack (Next.js 16.2.1, TypeScript, Tailwind, shadcn/ui, Prisma 7 + SQLite,
> ai@6.0.134, @ai-sdk/google-vertex@4.0.93, pdf-parse, mammoth) is already in place and is NOT re-researched here.

---

## Existing Stack Relevant to Slides

These packages are already installed. No changes or reinstalls needed:

| Package | Installed Version | Role in Slide Feature |
|---------|------------------|----------------------|
| `ai` | 6.0.134 | `generateText` + `Output.object()` for structured slide data extraction |
| `@ai-sdk/google-vertex` | 4.0.93 | `createVertex` provider — same instance already used for `streamText` |
| `zod` | (bundled with `ai`) | Schema definition for slide content objects |

---

## New Stack Addition: ONE Package Required

```bash
npm install pptxgenjs
```

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| `pptxgenjs` | 4.0.1 | PPTX file generation | De-facto JavaScript PPTX library. Zero runtime dependencies. Dual ESM/CJS build works in both Next.js API routes (Node.js) and browser. Ships full TypeScript definitions. `write('nodebuffer')` returns a `Promise<Buffer>` suitable for Next.js `Response`. `writeFile()` in browser triggers automatic download with correct MIME type. 4.0.1 released May 2025 — current stable. |

### Supporting Libraries

No additional packages are needed beyond `pptxgenjs`.

| Concern | Resolution | Extra Package? |
|---------|------------|---------------|
| Structured Gemini output | `generateText` + `Output.object()` from `ai@6` already installed | No |
| Client-side download trigger | Native `URL.createObjectURL` + `<a>` click — no library needed | No |
| Zod schemas for slide data | `zod` already available via `ai` | No |
| PPTX buffer in API route | `pres.write('nodebuffer')` returns `Buffer` — native Node.js | No |

---

## API Reference: pptxgenjs 4.0.1

### Core creation pattern

```typescript
import pptxgen from 'pptxgenjs';

const pres = new pptxgen();
const slide = pres.addSlide();

// addText(content, options) — x/y/w/h in inches
slide.addText('Trend Title', {
  x: 0.5, y: 0.5, w: 9, h: 1.2,
  fontSize: 28,
  bold: true,
  color: '1a1a2e',
  align: 'left',
});

slide.addText('Signal 1 — description', {
  x: 0.5, y: 2, w: 8.5, h: 0.5,
  fontSize: 14,
  color: '444444',
  bullet: true,
});
```

### Saving: Node.js API route vs browser

| Context | Method | Returns | Use case |
|---------|--------|---------|----------|
| Next.js API route (Node.js) | `pres.write('nodebuffer')` | `Promise<Buffer>` | Send as HTTP response with PPTX headers |
| Browser client-side | `pres.writeFile({ fileName: 'slide.pptx' })` | `Promise<string>` | Triggers browser download directly |
| General binary | `pres.write('arraybuffer')` | `Promise<ArrayBuffer>` | Pass to fetch / blob construction |

### v4.0 breaking change to be aware of

In v3, `write(outputType)` accepted the type as a plain string argument. In v4, the `outputType` positional parameter was finalized — `write('nodebuffer')` is the correct call. The old `save()` method was removed in v4; use `writeFile()` or `write()` instead.

### Next.js API route — complete pattern

```typescript
// app/api/slides/[projectId]/[slideType]/route.ts
export const runtime = 'nodejs';

import pptxgen from 'pptxgenjs';

export async function POST(req: Request) {
  const pres = new pptxgen();
  const slide = pres.addSlide();

  // ... populate slide from Gemini-extracted data ...

  const buffer = await pres.write('nodebuffer') as Buffer;

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'Content-Disposition': 'attachment; filename="trend-mapper.pptx"',
    },
  });
}
```

> **Important:** `export const runtime = 'nodejs'` is required. pptxgenjs uses Node.js built-ins; it will fail on the edge runtime.

### If webpack/bundler errors occur

pptxgenjs documentation notes occasional issues with bundlers (Webpack, Vite). The fix:

```javascript
// next.config.ts or next.config.js
const nextConfig = {
  transpilePackages: ['pptxgenjs'],
};
export default nextConfig;
```

---

## API Reference: generateText + Output.object (ai@6.0.134)

`generateObject` is **deprecated** in ai@6 and will be removed in a future version. The current API is `generateText` with the `Output` specification. This is what to use for both the completeness check and slide data extraction.

The `createVertex` instance is already initialized in every chat route — reuse the same pattern.

### Complete structured extraction pattern

```typescript
import { generateText, Output } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import { z } from 'zod';

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
});

// Define the slide content schema
const TrendMapperSlideSchema = z.object({
  isReadyForSlide: z.boolean().describe('true only if conversation has sufficient content for a complete slide'),
  trendName: z.string(),
  title: z.string(),
  signals: z.array(z.string()).min(1).max(4),
  implication: z.string(),
  timeHorizon: z.enum(['near-term', 'mid-term', 'long-term']),
});

// Run extraction
const { output } = await generateText({
  model: vertex('gemini-2.5-flash-preview-04-17'),
  output: Output.object({
    schema: TrendMapperSlideSchema,
    name: 'TrendMapperSlide',
    description: 'Structured slide content extracted from a Trend Mapper conversation',
  }),
  prompt: `Extract slide content from this conversation:\n\n${conversationText}`,
});

// output is fully typed: { isReadyForSlide: boolean, trendName: string, ... }
// output.isReadyForSlide is the completeness check result
```

### Output.object() parameter reference

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `schema` | Zod / Valibot / JSON schema | Yes | Drives both LLM instruction and TypeScript type inference |
| `name` | string | No | Optional hint to the LLM — use descriptive names |
| `description` | string | No | Optional context to improve extraction quality |

### generateText response properties when using Output.object()

| Property | Type | Description |
|----------|------|-------------|
| `output` | inferred from schema | Fully validated object — guaranteed to match schema type |
| `text` | string | Raw generation text (useful for debugging extraction failures) |
| `usage` | object | Token consumption — watch this against Gemini's token budget |

---

## Architecture: How the Two Libraries Compose

The recommended flow keeps Vertex AI credentials server-side:

```
Client "Generate Slide" button click
  → POST /api/slides/[projectId]/[slideType]
  → Route reads conversation messages from Prisma (SQLite)
  → generateText + Output.object() sends messages to Gemini → structured slide data
  → pptxgenjs builds .pptx from structured data in memory
  → pres.write('nodebuffer') → Buffer
  → Response(buffer, { Content-Type: PPTX MIME, Content-Disposition: attachment })
  → Browser receives binary response, triggers file download
```

### Client-side download trigger (no extra packages)

```typescript
// In a React component — no download library needed
async function handleGenerateSlide(slideType: string) {
  setIsGenerating(true);
  try {
    const res = await fetch(`/api/slides/${projectId}/${slideType}`, { method: 'POST' });
    if (!res.ok) throw new Error('Generation failed');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slideType}.pptx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } finally {
    setIsGenerating(false);
  }
}
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| `pptxgenjs@4` | `officegen` | Never — unmaintained since 2018, no TypeScript, no ESM |
| `pptxgenjs@4` | Google Slides API | Only if collaborative cloud editing is needed (explicitly out of scope) |
| `pptxgenjs@4` | `python-pptx` via subprocess | Never in Node.js context — adds language boundary and deployment complexity |
| `generateText + Output.object()` | `generateObject` | Never — `generateObject` is deprecated in ai@6, scheduled for removal |
| Server-side PPTX generation | Client-side pptxgenjs | pptxgenjs works in the browser too, but server-side keeps Gemini calls secure. If bundle size becomes a concern, client-side is a valid alternative for a future refactor. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `generateObject` from `ai` | Deprecated in ai@6.0 — will be removed in a future version per official migration guide | `generateText` with `Output.object({ schema })` |
| `streamObject` from `ai` | Also deprecated in ai@6.0 for same reason; slide extraction is atomic — streaming adds no value | `generateText` with `Output.object()` |
| `pptxgenjs@3.x` | v4 has cleaner dual ESM/CJS build, updated TypeScript types, removed IE11 dead weight | `pptxgenjs@4.0.1` |
| `export const runtime = 'edge'` on slide routes | pptxgenjs uses Node.js built-ins, incompatible with edge runtime | `export const runtime = 'nodejs'` |
| A separate "download" utility package (file-saver, downloadjs) | Overkill — native `URL.createObjectURL` + `<a>` click is sufficient in all modern browsers | Native browser APIs |

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `pptxgenjs@4.0.1` | Node.js 18+ | Next.js 16 defaults to Node 18+ — satisfied |
| `pptxgenjs@4.0.1` | `next@16.2.1` | Dual ESM/CJS build; add `transpilePackages` only if bundler error occurs |
| `pptxgenjs@4.0.1` | TypeScript | Ships own `.d.ts` — no `@types/pptxgenjs` needed |
| `Output.object()` | `ai@6.0.134` | Ships in the `ai` package — already installed |
| `Output.object()` | `@ai-sdk/google-vertex@4.0.93` | Same provider already used for streaming — no change needed |

---

## Installation

```bash
# Only one new package
npm install pptxgenjs
```

No new dev dependencies. No peer dependency conflicts expected.

---

## Sources

- [PptxGenJS npm page](https://www.npmjs.com/package/pptxgenjs) — v4.0.1 confirmed as current stable, zero runtime dependencies — HIGH confidence
- [PptxGenJS Quick Start](https://gitbrent.github.io/PptxGenJS/docs/quick-start/) — `new pptxgen()`, `addSlide()`, `addText()`, `writeFile()` API — HIGH confidence
- [PptxGenJS Saving Presentations](https://gitbrent.github.io/PptxGenJS/docs/usage-saving/) — `write('nodebuffer')` vs `writeFile()`, browser auto-download behavior — HIGH confidence
- [PptxGenJS Integration by Environment](https://gitbrent.github.io/PptxGenJS/docs/integration/) — Node 18+ requirement, Next.js webpack note — HIGH confidence
- [AI SDK 6 Migration Guide](https://ai-sdk.dev/docs/migration-guides/migration-guide-6-0) — `generateObject` deprecated, use `generateText` + `Output.object()` — HIGH confidence
- [AI SDK Output Reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/output) — `Output.object()` parameters, `schema`, response shape — HIGH confidence
- [AI SDK Generating Structured Data](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data) — current recommended pattern confirmed — HIGH confidence

---
*Stack research for: AI-powered slide generation (v2.1 milestone)*
*Researched: 2026-03-22*
