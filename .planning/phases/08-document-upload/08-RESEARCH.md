# Phase 8: Document Upload + Context Priority — Research

**Researched:** 2026-03-21
**Domain:** File upload (multipart/form-data in Next.js App Router), text extraction (PDF/DOCX/PPTX), Prisma 7 migration, context priority injection across multiple agent route handlers
**Confidence:** HIGH for PDF/DOCX extraction (installed libs verified), MEDIUM for PPTX (jszip-based approach confirmed available), HIGH for Next.js multipart handling

---

## Summary

Phase 8 adds per-project document upload to the platform. Three concerns:

1. **Prisma migration** — add `UploadedFile` model with FK to Project, cascade delete.
2. **File upload API** — multipart POST with extraction; GET list; DELETE per file.
3. **UI + context wiring** — upload UI in AgentWorkspace, context priority injection across all 4 agent route handlers.

The extraction libraries are already installed for two of the three supported types. PPTX extraction requires the jszip library which is available as a transitive dependency — but it is not in `package.json` as a direct dependency and should be added explicitly. The recommended approach is detailed below.

---

## Extraction Library Findings

### PDF — `pdf-parse` (installed, v2.4.5)

**Status:** Already installed as a direct dependency in `package.json`. Version 2.4.5 is an updated fork that fixes the v1.x debug mode bug.

**Usage:**
```typescript
import pdfParse from 'pdf-parse'

const dataBuffer = Buffer.from(await file.arrayBuffer())
const data = await pdfParse(dataBuffer)
const extractedText = data.text  // plain text from all pages
```

**Caveat:** `pdf-parse` must run in Node.js runtime (not Edge). The route handler MUST export `export const runtime = 'nodejs'`. This is already the pattern on the Trend Mapper route.

**Type definitions:** `@types/pdf-parse` is also installed.

---

### DOCX — `mammoth` (installed, v1.12.0)

**Status:** Already installed as a direct dependency in `package.json`. Used in Phase 1 for megatrend document extraction.

**Usage:**
```typescript
import mammoth from 'mammoth'

const dataBuffer = Buffer.from(await file.arrayBuffer())
const result = await mammoth.extractRawText({ buffer: dataBuffer })
const extractedText = result.value  // plain text, all formatting stripped
```

**Note:** `extractRawText` strips all Word formatting and returns plain text — correct for LLM context injection. `convertToHtml` is NOT what we want here.

---

### PPTX — `jszip` + XML extraction (transitive dependency, must add to package.json)

**Status:** `jszip@3.10.1` is available in `node_modules/jszip` as a transitive dependency of another package. It is NOT listed in `package.json` as a direct dependency. **Must run `npm install jszip` to make it a direct dependency** — relying on transitive dependencies is fragile.

**No dedicated PPTX text extraction library is installed** — `pptx-extract`, `officegen`, and `pptx2json` are NOT in node_modules. `unzipper` is also NOT installed.

**Recommended approach:** PPTX files are ZIP archives. `jszip` can open them. Text content lives in `ppt/slides/slide{N}.xml` files as XML with `<a:t>` text run elements. Extract all text from those elements.

**PPTX extraction implementation:**
```typescript
import JSZip from 'jszip'

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer)
  const slideFiles = Object.keys(zip.files)
    .filter(name => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort()  // slide1.xml, slide2.xml, ...

  const texts: string[] = []
  for (const slideFile of slideFiles) {
    const xml = await zip.files[slideFile].async('text')
    // Extract all <a:t> text runs — these contain the visible slide text
    const matches = xml.matchAll(/<a:t[^>]*>([^<]*)<\/a:t>/g)
    for (const match of matches) {
      const text = match[1].trim()
      if (text) texts.push(text)
    }
  }
  return texts.join(' ')
}
```

**Limitations:** This approach extracts raw text from slide XML. It won't preserve slide structure or speaker notes (speaker notes are in `ppt/notesSlides/notesSlide{N}.xml` — can be added if needed). For the purpose of LLM context injection, flat text is sufficient.

**Install required:** `npm install jszip` and `npm install --save-dev @types/jszip`

---

## Next.js 16.2.1 Multipart/Form-Data Handling

The Next.js docs (`node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`) confirm Route Handlers use Web `Request`/`Response` APIs. File upload is handled using the native `request.formData()` method — no additional libraries (busboy, formidable, multer) are needed.

**Confirmed pattern for this version:**
```typescript
export const runtime = 'nodejs'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  // ... extract text, write to disk, save to DB
}
```

**Key points:**
- `request.formData()` is natively available — no parser library needed
- `file.arrayBuffer()` is available on the Web `File` object
- `Buffer.from()` converts ArrayBuffer to Node.js Buffer for use with pdf-parse and mammoth
- `export const runtime = 'nodejs'` is REQUIRED for pdf-parse and mammoth (both use Node.js internals)
- The route must NOT use the Edge runtime

**Max size enforcement:** There is no built-in Next.js mechanism to enforce a max request body size for Route Handlers in dev mode. Enforce manually: check `file.size` before processing and return 400 if exceeded. `10 * 1024 * 1024 = 10485760` bytes = 10MB.

---

## File Storage Strategy

Per the PROJECT.md architecture decision: `uploads/[projectId]/[uuid].[ext]`

```typescript
import path from 'path'
import fs from 'fs/promises'
import { randomUUID } from 'crypto'

const uploadsDir = path.join(process.cwd(), 'uploads', projectId)
await fs.mkdir(uploadsDir, { recursive: true })

const ext = path.extname(file.name)
const filename = `${randomUUID()}${ext}`
const filePath = path.join(uploadsDir, filename)
await fs.writeFile(filePath, buffer)
```

**Cleanup on DELETE:** Remove the file from disk before or after deleting the DB record.
```typescript
const filePath = path.join(process.cwd(), 'uploads', projectId, uploadedFile.filename)
await fs.unlink(filePath).catch(() => {})  // ignore if already missing
await prisma.uploadedFile.delete({ where: { id: fileId } })
```

**`.gitignore`:** Add `uploads/` to `.gitignore` — uploaded files are runtime data, not source code.

---

## Context Priority Order

The ROADMAP specifies this exact priority order for all 4 agent route handlers:

```
1. Agent system prompt (from lib/context.ts — getSystemContext / getValueDesignerContext / getSPIContext / getFAROContext)
2. [Current FUND II Session: N of 10]   (already added in Phase 5 as systemWithSession)
3. Global system docs (already included in each agent's context loader output)
4. Per-project uploaded documents — fetched from DB and injected as:
   [STUDENT UPLOADED DOCUMENTS — highest priority for this project. Consult these before searching the web:]
   [Document: {originalName}]
   {extractedText}
   [End of uploaded documents]
5. Web search via googleSearch tool (Trend Mapper and FARO only)
```

**Implementation:** After fetching uploaded files for the project, append them to `systemWithSession` before passing to `streamText`:

```typescript
const uploadedFiles = await prisma.uploadedFile.findMany({
  where: { projectId },
  orderBy: { createdAt: 'asc' },
  select: { originalName: true, extractedText: true },
})

const uploadedDocsBlock = uploadedFiles.length > 0
  ? '\n\n[STUDENT UPLOADED DOCUMENTS — highest priority for this project. Consult these before searching the web:]\n' +
    uploadedFiles.map(f => `[Document: ${f.originalName}]\n${f.extractedText}`).join('\n\n') +
    '\n[End of uploaded documents]'
  : ''

const systemWithDocs = systemWithSession + uploadedDocsBlock
```

Pass `systemWithDocs` (not `systemWithSession`) as the `system` parameter to `streamText`.

**The system prompt instruction:** Each agent's context loader already injects the agent's full spec text. Add one sentence at the END of the assembled system string: "Always prioritise pre-loaded course materials and student-uploaded documents over web search results." This is appended as part of the `uploadedDocsBlock` or as a fixed suffix.

---

## MIME Type Reference

| Format | MIME Type | Extractor |
|--------|-----------|-----------|
| DOCX | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | mammoth |
| PDF | `application/pdf` | pdf-parse |
| PPTX | `application/vnd.openxmlformats-officedocument.presentationml.presentation` | jszip + XML |

**Validation:** Only accept these three MIME types. Return 400 for anything else.

---

## Agent Route Handlers (Post Phase 5/6/7)

Phase 8 runs AFTER Phases 5, 6, and 7. By the time Phase 8 executes, there will be 4 agent route handlers:

| Agent | Route Handler Path | Web Search |
|-------|-------------------|------------|
| Trend Mapper | `src/app/api/chat/[projectId]/route.ts` | Yes (googleSearch) |
| Value Designer | `src/app/api/chat/value-designer/[projectId]/route.ts` | No |
| SPI | `src/app/api/chat/spi/[projectId]/route.ts` | No |
| FARO | `src/app/api/chat/faro/[projectId]/route.ts` | Yes (googleSearch) |

All 4 route handlers must be updated in Plan 08-03 to inject uploaded document context. The update is identical in each — add the DB query for uploaded files and append the `uploadedDocsBlock` to the system string.

---

## Upload UI Placement

Per the Phase 5 plan (05-03), `AgentWorkspace.tsx` exists at `src/components/AgentWorkspace.tsx`. It renders the agent tabs and a ChatWindow per agent. The file upload UI should be added to AgentWorkspace below the `AgentTabs` component and above the chat windows, as a collapsible or compact section.

**Recommended UI structure (inside AgentWorkspace):**
```tsx
<div className="flex flex-col h-full">
  <AgentTabs ... />
  <FileUploadPanel projectId={projectId} />   {/* NEW */}
  <div className="flex-1 overflow-hidden relative">
    {/* agent ChatWindows */}
  </div>
</div>
```

`FileUploadPanel` is a new Client Component at `src/components/FileUploadPanel.tsx`. It:
- Shows a compact "Upload file" button and accepted types label
- Lists uploaded files with delete buttons
- Fetches file list from `GET /api/projects/[id]/files` on mount
- POSTs via FormData to `POST /api/projects/[id]/files`
- DELETEs via `DELETE /api/projects/[id]/files/[fileId]`
- Shows inline errors for size/type violations

---

## Pitfalls

### Pitfall 1: pdf-parse debug mode crash in v1.x
v1.x of pdf-parse runs `fs.readFileSync` on a test file that doesn't exist in production builds. v2.4.5 (installed) fixes this. No workaround needed.

### Pitfall 2: PPTX extraction misses text in grouped shapes
The `<a:t>` regex approach extracts text from standard text runs. Text inside grouped shapes or tables may use the same XML elements but be nested differently. This is acceptable for MVP — if text is missing, it's missing silently (no crash).

### Pitfall 3: Using jszip as transitive dep without direct install
`jszip` is in node_modules as a transitive dep but if the parent package removes it, builds will break. Must `npm install jszip` to add it to package.json.

### Pitfall 4: Missing uploads/ directory at startup
The uploads directory is created lazily per-project on first upload. No global initialization needed — `fs.mkdir(uploadsDir, { recursive: true })` handles it.

### Pitfall 5: File route conflicts with project [id] route
`src/app/api/projects/[id]/route.ts` handles GET/PATCH/DELETE for projects. `src/app/api/projects/[id]/files/route.ts` is a nested route — they coexist cleanly. No conflict.

### Pitfall 6: Forgetting to update all 4 route handlers
Plan 08-03 must update ALL FOUR agent route handlers. If one is missed, uploaded docs won't be available in that agent's context. The plan explicitly names all 4 files.

---

## Required New Dependency

```bash
npm install jszip
npm install --save-dev @types/jszip
```

All other needed packages (`pdf-parse`, `mammoth`, `prisma`, `better-sqlite3`, `react`) are already installed.

---

*Research date: 2026-03-21*
*Valid until: 2026-05-21 (pinned package versions)*
