# Phase 5: Multi-Agent Platform Shell — Research

**Researched:** 2026-03-21
**Domain:** Prisma 7 migrations, Next.js 16.2.1 App Router tab navigation, React state management, AI SDK v6 route handler extension
**Confidence:** HIGH (stack fully verified against live codebase)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | User can switch between all 4 agents within a project using a tabbed interface, without losing chat history for any agent | Tab state via React useState in Client Component; per-tab message arrays loaded on mount from DB via agentType filter |
| PLAT-02 | A global session tracker (Session 1–10) is visible and settable from the main UI | AppSettings singleton in Prisma; GET/PATCH /api/settings/session route; session selector in ProjectLayout sidebar |
| PLAT-03 | The current session number is injected into every agent's system prompt so behavior is session-aware | Session number fetched server-side or passed as prop; appended to system string in route handler |
| AGENT-09 | All 4 agents are present in every project from creation — no per-project agent selection required | 4 fixed tabs rendered unconditionally in project page; no DB changes needed for this requirement beyond agentType on Message |
| SEARCH-02 | A "Deep Research" toggle is available per message for Trend Mapper and FARO — activates gemini-2.5-pro + googleSearch + urlContext tools | deepResearch boolean in POST body; conditional model + tools selection in route handler; toggle button added to ChatInput |
</phase_requirements>

---

## Summary

Phase 5 is a UI and data migration phase. It adds no new AI logic — it restructures the existing Trend Mapper into a platform that can host 4 agents. The work breaks into three independent concerns: (1) a Prisma migration that adds `agentType` to `Message` and creates the `AppSettings` singleton, (2) a new API route plus sidebar widget for the global session number, and (3) refactoring the project page to render 4 tabs with isolated message threads and wiring the Deep Research toggle into the existing Trend Mapper route.

The existing codebase is clean and straightforward. `ChatWindow` is a self-contained Client Component that manages its own message state, so the tab refactor is a matter of rendering 4 independent `ChatWindow` instances (one per agent) and conditionally mounting/unmounting vs. hiding them to preserve history. React `useState` for active tab is the right choice — no URL state needed because tabs within a project are ephemeral session state, and the project page already has the project ID in the URL.

The Deep Research toggle is a pure frontend boolean + a conditional branch in the existing Trend Mapper route handler. The SDK v6 pattern is already established: swap `vertex('gemini-2.5-flash')` for `vertex('gemini-2.5-pro')` and add `vertex.tools.urlContext({})` alongside `google_search` in the tools object. No new packages required.

**Primary recommendation:** Migrate DB first (Plan 05-01), then session API (Plan 05-02), then tab UI + deep research toggle (Plan 05-03). Each plan is independently deployable and testable.

---

## Standard Stack

### Core (all already installed — no new dependencies required)

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| prisma | 7.5.0 | DB migration: add agentType + AppSettings | Already in use; driver adapter pattern established |
| @ai-sdk/google-vertex | 4.0.93 | Deep research model swap + urlContext tool | Already wired; googleVertexTools confirmed at this version |
| ai (Vercel AI SDK) | 6.0.134 | streamText already in route handler | Already in use |
| next | 16.2.1 | App Router, Route Handlers, Server Components | Project constraint |
| react | 19.2.4 | useState for tab + deepResearch state | Already in use |

**No new npm installs needed for Phase 5.**

### Supporting Tools Available in SDK

| Tool | Source | Phase 5 Use |
|------|--------|-------------|
| `vertex.tools.googleSearch({})` | `@ai-sdk/google-vertex` | Already in Trend Mapper route; kept for deep research mode |
| `vertex.tools.urlContext({})` | `@ai-sdk/google-vertex` | Added in deep research mode alongside googleSearch |
| `vertex('gemini-2.5-pro')` | `@ai-sdk/google-vertex` | Deep research model upgrade |

**Verified:** `googleVertexTools` exports `urlContext` at v4.0.93 — confirmed in ROADMAP.md research flags as "IS available." Deep research = model upgrade (flash → pro) + add urlContext tool. No `thinkingConfig` — confirmed not available in this SDK version.

---

## Architecture Patterns

### Recommended Project Structure Changes

```
src/
├── app/
│   ├── api/
│   │   ├── chat/[projectId]/route.ts     # UPDATE: add agentType + session + deepResearch params
│   │   └── settings/
│   │       └── session/route.ts          # NEW: GET + PATCH for AppSettings.sessionNumber
│   └── projects/[projectId]/
│       └── page.tsx                      # REFACTOR: 4 tabs, each with ChatWindow instance
├── components/
│   ├── ChatWindow.tsx                    # UPDATE: accept agentType + currentSession props; pass in POST body
│   ├── ChatInput.tsx                     # UPDATE: add deepResearch toggle prop + onToggle handler
│   └── AgentTabs.tsx                     # NEW: tab bar component (4 tabs)
└── lib/
    └── prisma.ts                         # No change
prisma/
└── schema.prisma                         # ADD: agentType to Message, AppSettings model
```

### Pattern 1: Prisma Migration — agentType with Default

**What:** Add `agentType String @default("trend-mapper")` to `Message`. All existing rows get the default automatically during migration.
**When to use:** Any migration that must not break existing data.

```prisma
// prisma/schema.prisma
model Message {
  id        String   @id @default(cuid())
  projectId String
  agentType String   @default("trend-mapper")   // NEW
  role      String
  content   String
  createdAt DateTime @default(now())
  project   Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
  @@index([projectId, agentType, createdAt])    // NEW: speeds up per-agent history queries
}
```

**Migration command:**
```bash
npx prisma migrate dev --name add_agent_type_and_app_settings
```

SQLite `ALTER TABLE ADD COLUMN` with a default value is safe and non-destructive. Existing rows automatically get `agentType = 'trend-mapper'`. The composite index on `[projectId, agentType, createdAt]` is worth adding now — it will be used by every agent history query in Phases 6 and 7.

### Pattern 2: AppSettings Singleton — Upsert Pattern

**What:** One global row with id=1 and sessionNumber. Always upsert on write, never insert duplicates.

```prisma
// prisma/schema.prisma
model AppSettings {
  id            Int @id @default(1)
  sessionNumber Int @default(1)
}
```

```typescript
// Seed one row after migration (run once, idempotent)
await prisma.appSettings.upsert({
  where: { id: 1 },
  create: { id: 1, sessionNumber: 1 },
  update: {},
})

// Read
const settings = await prisma.appSettings.findUnique({ where: { id: 1 } })

// Update
await prisma.appSettings.update({
  where: { id: 1 },
  data: { sessionNumber: newValue },
})
```

**Key insight:** Using `id: 1` as a fixed integer makes the singleton pattern explicit and avoids needing a separate key column. SQLite handles this correctly. No `@default(autoincrement())` — the id is always 1.

### Pattern 3: Session API Route Handler

**What:** GET returns current session number; PATCH updates it.

```typescript
// src/app/api/settings/session/route.ts
export const dynamic = 'force-dynamic'

export async function GET() {
  const settings = await prisma.appSettings.findUnique({ where: { id: 1 } })
  return NextResponse.json({ sessionNumber: settings?.sessionNumber ?? 1 })
}

export async function PATCH(request: Request) {
  const { sessionNumber } = await request.json()
  // Validate: must be 1–10
  if (typeof sessionNumber !== 'number' || sessionNumber < 1 || sessionNumber > 10) {
    return NextResponse.json({ error: 'Invalid session number' }, { status: 400 })
  }
  const updated = await prisma.appSettings.update({
    where: { id: 1 },
    data: { sessionNumber },
  })
  return NextResponse.json({ sessionNumber: updated.sessionNumber })
}
```

**Note on `force-dynamic`:** GET routes in Next.js 16 App Router may be statically cached. Add `export const dynamic = 'force-dynamic'` to ensure live DB reads — the same pattern already used in `/api/projects`.

### Pattern 4: Agent Tab Navigation — React State (Not URL)

**What:** Track active tab with `useState` in the project page (or a Client Component wrapper). Do NOT use `useSearchParams` or URL params for tabs.

**Rationale:** URL-based tab state in Next.js App Router requires `useSearchParams`, which forces a Suspense boundary around the entire consuming component tree. For a chat window that's already complex, this adds unnecessary re-render risk. The tab choice is ephemeral session state — the user doesn't need to bookmark or share a specific tab. React `useState` is simpler, faster, and correct here.

**Implementation approach:**

```typescript
// In a Client Component wrapper (e.g., AgentWorkspace.tsx)
'use client'
const AGENTS = ['trend-mapper', 'value-designer', 'spi', 'faro'] as const
type AgentType = typeof AGENTS[number]

export default function AgentWorkspace({ projectId, initialMessages, currentSession }) {
  const [activeAgent, setActiveAgent] = useState<AgentType>('trend-mapper')
  // ... render tabs + conditional ChatWindow
}
```

**Tab rendering strategy — use CSS visibility, not conditional mount:**
To preserve chat history across tab switches without re-fetching from DB, render all 4 `ChatWindow` instances on mount but show only the active one. Each `ChatWindow` manages its own message state; switching tabs just toggles CSS visibility.

```tsx
{AGENTS.map((agent) => (
  <div key={agent} className={activeAgent === agent ? 'block' : 'hidden'}>
    <ChatWindow
      projectId={projectId}
      agentType={agent}
      initialMessages={initialMessagesByAgent[agent]}
      currentSession={currentSession}
    />
  </div>
))}
```

The Server Component loads initial messages for all 4 agents in parallel using `Promise.all` with 4 Prisma queries filtered by `agentType`. This is 4 fast indexed SQLite queries — negligible overhead.

### Pattern 5: Passing agentType + Session into Route Handler

**What:** ChatWindow sends `agentType`, `deepResearch`, and `currentSession` in the POST body to the route handler.

```typescript
// ChatWindow.tsx — updated fetch call
const res = await fetch(`/api/chat/${projectId}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    messages: [{ role: 'user', content: userText }],
    agentType,       // 'trend-mapper' | 'value-designer' | 'spi' | 'faro'
    currentSession,  // 1–10
    deepResearch,    // boolean
  }),
})
```

```typescript
// route.ts — updated destructure
const { messages: incomingMessages, agentType, currentSession, deepResearch } = await request.json()

// Filter DB history by agentType
const dbMessages = await prisma.message.findMany({
  where: { projectId, agentType: agentType ?? 'trend-mapper' },
  orderBy: { createdAt: 'asc' },
})

// Persist user message with agentType
await prisma.message.create({
  data: { projectId, agentType: agentType ?? 'trend-mapper', role: 'user', content: userMessageContent },
})

// Deep research conditional
const model = deepResearch ? vertex('gemini-2.5-pro') : vertex('gemini-2.5-flash')
const tools = deepResearch
  ? { google_search: vertex.tools.googleSearch({}), urlContext: vertex.tools.urlContext({}) }
  : { google_search: vertex.tools.googleSearch({}) }

// Session injection — append to system context string
const systemWithSession = `${systemContext}\n\n[Current FUND II Session: ${currentSession ?? 1} of 10]`
```

### Pattern 6: Deep Research Toggle in ChatInput

**What:** A toggle button beside the Send button. Maintains boolean state. Passes state up via callback or is managed in ChatWindow and passed down.

**Recommended:** Manage `deepResearch` state in `ChatWindow` (where `sendMessage` lives), pass down to `ChatInput` as props.

```typescript
// ChatInput — updated props
interface ChatInputProps {
  onSubmit: (message: string) => void
  disabled: boolean
  deepResearch: boolean
  onDeepResearchToggle: () => void
  showDeepResearch: boolean  // false for VD/SPI tabs — hides the toggle
}
```

Visual: a small button with label "Deep Research" or a microscope icon, active state shown with a blue/highlighted background. Only shown when `showDeepResearch` is true (Trend Mapper tab — for now; FARO in Phase 7).

### Pattern 7: Session Selector in Sidebar

**What:** A compact 1–10 stepper or dropdown in the `ProjectLayout` sidebar. Fetches current session on mount; PATCHes on change with optimistic update.

**Placement:** Bottom of the sidebar `nav` section, or top of the sidebar below the "Dashboard" link. Sidebar already exists in `ProjectLayout.tsx` — add a new section there.

**State management:** Local `useState` in `ProjectLayout` (already a Client Component). On mount, `useEffect` fetches `/api/settings/session`. On change, optimistically update local state then PATCH.

```typescript
// In ProjectLayout.tsx
const [sessionNumber, setSessionNumber] = useState(1)

useEffect(() => {
  fetch('/api/settings/session')
    .then(r => r.json())
    .then(d => setSessionNumber(d.sessionNumber))
}, [])

async function handleSessionChange(n: number) {
  setSessionNumber(n)  // optimistic
  await fetch('/api/settings/session', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionNumber: n }),
  })
}
```

**Passing session to ChatWindow:** `ProjectLayout` receives `sessionNumber` state; it needs to pass it down to the project page children. Since `ProjectLayout` wraps children as `React.ReactNode`, it cannot inject props directly into children. Two options:

1. **React Context** — Create a `SessionContext` provider in `ProjectLayout`, consume with `useContext` in `ChatWindow`. Cleanest for cross-tree prop passing.
2. **Prop drilling through layout** — Requires making `AgentWorkspace` a sibling of `ProjectLayout` rather than a child, fetching session separately in the workspace. Simpler but slightly less DRY.

**Recommendation: React Context.** Create `SessionContext` with `sessionNumber` + `setSessionNumber`. Wrap the whole layout. `ChatWindow` or its parent `AgentWorkspace` consumes the context to read `currentSession` for the POST body.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tab persistence across switches | Custom message cache / localStorage | CSS `hidden` + all-4-mounted pattern | Hidden DOM preserves React state naturally; no serialization needed |
| Session API singleton | Multi-row settings table + find-first | `id: 1` upsert on `AppSettings` | Explicit, zero drift, idempotent seeding |
| Per-agent chat threads | Separate DB tables per agent | `agentType` field filter on single `Message` table | Preserves existing data, simpler schema, no JOIN complexity |
| Deep research feature detection | SDK capability probing | Hardcoded model string swap + tools array | SDK version is pinned; no runtime probing needed |
| Session number propagation | URL params + searchParams hook | React Context in ProjectLayout | Avoids Suspense boundary complexity in App Router |

---

## Common Pitfalls

### Pitfall 1: Forgetting to Update Existing Trend Mapper Queries

**What goes wrong:** After adding `agentType` to the schema, queries in the route handler that load history without a `where: { agentType: 'trend-mapper' }` filter will return messages from all 4 agents mixed together.
**Why it happens:** The migration adds the column with a default, so existing rows are safe — but the query filter must be added explicitly.
**How to avoid:** In Plan 05-01, after the migration, immediately update the route handler DB queries to include `agentType` in the where clause.
**Warning signs:** Trend Mapper history includes blank/empty messages or messages from the wrong agent.

### Pitfall 2: React State Lost on Tab Remount

**What goes wrong:** If tabs are rendered with conditional mounting (`{activeAgent === 'trend-mapper' && <ChatWindow />}`) instead of CSS hiding, switching tabs destroys and recreates `ChatWindow` state — streaming in progress is cancelled, messages are lost until page refresh.
**Why it happens:** Conditional rendering unmounts the component, resetting all `useState`.
**How to avoid:** Use the CSS `hidden/block` pattern — render all 4 `ChatWindow` instances always, toggle visibility. This keeps React state alive across tab switches.
**Warning signs:** Chat history disappears when switching back to a tab mid-conversation.

### Pitfall 3: AppSettings Row Missing at Runtime

**What goes wrong:** The GET `/api/settings/session` returns null if the upsert seed was never run, causing the UI to show no session or crash on `.sessionNumber` access.
**Why it happens:** Prisma migrations create the table but don't seed data.
**How to avoid:** Run the upsert seed as part of Plan 05-01 after migration. Make the GET handler defensive: `settings?.sessionNumber ?? 1` as a fallback.
**Warning signs:** Session selector shows blank or errors on first load of a fresh DB.

### Pitfall 4: Next.js 16 GET Route Caching

**What goes wrong:** `GET /api/settings/session` returns a stale cached value because Next.js 16 statically optimizes GET Route Handlers by default.
**Why it happens:** Next.js App Router caches GET handlers unless opted out.
**How to avoid:** Add `export const dynamic = 'force-dynamic'` to the session route file. This is the same pattern already correctly applied in `/api/projects/route.ts` in this codebase.
**Warning signs:** Session number doesn't update after PATCH until page hard-refresh.

### Pitfall 5: urlContext Tool Availability Check

**What goes wrong:** Passing `vertex.tools.urlContext({})` causes a runtime error if the tool doesn't exist in the installed SDK version.
**Why it happens:** The ROADMAP.md confirms urlContext IS available at v4.0.93, but the exact call signature should be verified against the actual export during implementation.
**How to avoid:** During Plan 05-03 implementation, check: `import { googleVertexTools } from '@ai-sdk/google-vertex'` and verify `urlContext` is exported before using it. The ROADMAP already flags this as confirmed — this is a low-risk verification step.
**Warning signs:** TypeScript error "Property 'urlContext' does not exist on type ..." at import time.

### Pitfall 6: Session Number Not Refreshed When Project Page Loads

**What goes wrong:** The session number shown in the UI is the value from the initial `useEffect` fetch. If the user changes session in a different browser tab, the value drifts.
**Why it happens:** Single-user app with no real-time sync.
**How to avoid:** This is acceptable for the single-user MVP — no fix needed. Document that session number is fetched on mount only.

---

## Code Examples

### Loading Initial Messages for All 4 Agents (Server Component)

```typescript
// src/app/projects/[projectId]/page.tsx
const AGENT_TYPES = ['trend-mapper', 'value-designer', 'spi', 'faro'] as const

const [settings, ...agentHistories] = await Promise.all([
  prisma.appSettings.findUnique({ where: { id: 1 } }),
  ...AGENT_TYPES.map(agentType =>
    prisma.message.findMany({
      where: { projectId, agentType },
      orderBy: { createdAt: 'asc' },
    })
  ),
])

const currentSession = settings?.sessionNumber ?? 1
const initialMessagesByAgent = Object.fromEntries(
  AGENT_TYPES.map((agent, i) => [agent, agentHistories[i]])
)
```

### Route Handler — Updated for agentType + Session + deepResearch

```typescript
// Key changes to src/app/api/chat/[projectId]/route.ts
const { messages: incomingMessages, agentType = 'trend-mapper', currentSession = 1, deepResearch = false } = await request.json()

// Scoped history
const dbMessages = await prisma.message.findMany({
  where: { projectId, agentType },
  orderBy: { createdAt: 'asc' },
})

// Scoped persist
await prisma.message.create({
  data: { projectId, agentType, role: 'user', content: userMessageContent },
})

// System prompt with session
const systemWithSession = `${getSystemContext()}\n\n[Current FUND II Session: ${currentSession} of 10]`

// Model + tools conditional
const model = deepResearch ? vertex('gemini-2.5-pro') : vertex('gemini-2.5-flash')
const tools = deepResearch
  ? { google_search: vertex.tools.googleSearch({}), urlContext: vertex.tools.urlContext({}) }
  : { google_search: vertex.tools.googleSearch({}) }

const result = streamText({
  model,
  system: systemWithSession,
  tools,
  messages: [...historyMessages, { role: 'user', content: userMessageContent }],
  onFinish: async (event) => {
    await prisma.message.create({
      data: { projectId, agentType, role: 'model', content: event.text },
    })
  },
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `role: 'model'` in AI SDK | `role: 'assistant'` in AI SDK v6 | ai v6 (already handled in Phase 3) | Conversion on DB read already done in route.ts |
| Prisma 5 client generation | Prisma 7 driver adapter pattern | Prisma 7.x | Already implemented in lib/prisma.ts — no change |
| `thinkingConfig` / `budgetTokens` | Not available in @ai-sdk/google-vertex 4.0.93 | — | Deep research = model swap + urlContext only |

---

## Open Questions

1. **urlContext call signature**
   - What we know: Available in @ai-sdk/google-vertex 4.0.93 per ROADMAP research flag
   - What's unclear: Whether it takes `({})` like googleSearch or has required params
   - Recommendation: During Plan 05-03, check the TypeScript types: `vertex.tools.urlContext` — if it has required params, pass an empty options object and let TypeScript error guide correction

2. **`googleSearch` + `urlContext` together in one call**
   - What we know: Both are in googleVertexTools; the ROADMAP flags this as "should work but confirm"
   - What's unclear: Whether Vertex AI API enforces mutual exclusivity between the two tools
   - Recommendation: Test in Plan 05-03 with a real request. If Vertex AI rejects dual tools, fall back to urlContext-only for deep research mode (Pro model + urlContext, drop googleSearch in deep mode)

3. **React Context vs prop drilling for sessionNumber**
   - What we know: ProjectLayout is a Client Component; ChatWindow is a child of children (not directly renderable with props from layout)
   - Recommendation: React Context is the correct pattern here. Create a small `SessionContext` — it's 15 lines of code and avoids a messy architecture

---

## Validation Architecture

> nyquist_validation not explicitly disabled — section included.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | None detected — no jest.config, vitest.config, or test directories found |
| Config file | None — Wave 0 must create if automated testing is desired |
| Quick run command | Manual browser test (no automated framework installed) |
| Full suite command | Manual browser test |

### Phase Requirements — Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| PLAT-01 | Switching tabs preserves chat history | manual-smoke | n/a — no test framework | Verify by sending message in Tab A, switching to Tab B and back |
| PLAT-02 | Session selector persists across page refresh | manual-smoke | n/a | Change to Session 5, refresh, verify still 5 |
| PLAT-03 | Session number appears in system prompt | manual-smoke | n/a | Check route handler logs or add console.log in dev |
| AGENT-09 | All 4 tabs present in every project | manual-smoke | n/a | Open any project, count 4 tabs |
| SEARCH-02 | Deep research toggle sends deepResearch:true | manual-smoke | n/a | Network tab in DevTools — inspect POST body |

### Wave 0 Gaps

No automated test framework is installed. Given the project has no test infrastructure and all prior phases were verified manually, continue with manual verification only for Phase 5. If automated testing is desired, install vitest + @testing-library/react as a Wave 0 task (out of scope for this phase per current trajectory).

---

## Sources

### Primary (HIGH confidence)
- Live codebase read: `prisma/schema.prisma`, `src/app/api/chat/[projectId]/route.ts`, `src/components/ChatWindow.tsx`, `src/components/ChatInput.tsx`, `src/components/ProjectLayout.tsx`, `src/app/projects/[projectId]/page.tsx`, `src/app/projects/[projectId]/layout.tsx`, `src/lib/prisma.ts`
- `.planning/ROADMAP.md` — Phase 5 plan details, deep research implementation notes, confirmed urlContext availability
- `package.json` — verified installed versions: next@16.2.1, @ai-sdk/google-vertex@4.0.93, prisma@7.5.0, ai@6.0.134, react@19.2.4
- `prisma.config.ts` — confirmed migration path and datasource config

### Secondary (MEDIUM confidence)
- ROADMAP.md v2.0 Research Flags — `thinkingConfig` confirmed unavailable, urlContext confirmed available, googleSearch+urlContext dual-tool use flagged as "should work"

### Tertiary (LOW confidence — flag for implementation-time verification)
- urlContext exact call signature — not verified against SDK source, inferred from googleSearch pattern

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified from package.json + live codebase
- Architecture: HIGH — patterns derived from existing working code in the repo
- Pitfalls: HIGH — identified from direct inspection of the existing route handler and component structure
- urlContext signature: LOW — inferred, must verify during Plan 05-03

**Research date:** 2026-03-21
**Valid until:** 2026-04-21 (stable stack — Prisma 7 and @ai-sdk/google-vertex are pinned in package.json)
