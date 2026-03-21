# Phase 7: FARO Agent — Research

**Researched:** 2026-03-21
**Domain:** Syllabi extraction, token budget analysis, FARO knowledge base assembly, Vertex AI deep research mode
**Confidence:** HIGH (stack fully verified against live codebase and SDK type definitions)

---

## Summary

Phase 7 wires FARO — the FUND II Course Navigator — with its full knowledge base and a route handler that mirrors the Trend Mapper's architecture but adds FARO-specific context loading. The work splits cleanly into two plans: (1) extract syllabi to `src/context/faro/`, measure tokens, produce summaries if needed, and implement `getFAROContext()` in `src/lib/context.ts`; and (2) implement the route handler at `src/app/api/chat/faro/[projectId]/route.ts` with standard + deep research modes.

Phase 6 (Value Designer & SPI) produces the agent routing switch in `ChatWindow` — Plan 07-02 adds `faro` to that same routing map (per the Phase 6 Plan 06-03 design). FARO and VD/SPI can execute in parallel after Phase 5 completes; there is no cross-dependency between Phase 6 and Phase 7 beyond the shared routing map that 06-03 creates.

---

## Syllabi Inventory

### What Exists

| File | Status | Notes |
|------|--------|-------|
| `ENTRE syllabi - FUND I II and Electives/FUND_II_Syllabus.txt` | ALREADY EXTRACTED | ~487 lines, ~9K tokens — ready to copy |
| All other syllabi (NAVEI, VCIC, SEARCH, BMI, BMC, Corp Ent, SEI, Entrepreneurial Finance, Creativity, Sports, FUND I, etc.) | PDF ONLY | Must be extracted using `pdf-parse` (already installed) |

### Full PDF Inventory in Syllabi Folder

```
114763_MBA-2026__Winter_Term_Entrepreneurial_Finance_3_Syllabus(1).pdf         — Entrepreneurial Finance (term 3 version)
114766_MBA-2026__Winter_Term_Venture_Capital_Investment_Competition_Course_1_Syllabus(1)-1.pdf — VCIC Course 1
114767_MBA-2026__Winter_Term_Venture_Capital_Investment_Competition_Course_2_Syllabus.pdf       — VCIC Course 2
2025_07_Entrepreneurial Finance 1_2_final.pdf                                  — Entrepreneurial Finance (terms 1+2)
BMC 2025 Syllabus.pdf                                                          — Business Model Challenge 2025
BMC Syllabus 090524.pdf                                                        — Business Model Challenge (earlier version)
BMI Syllabus 2025.pdf                                                          — Business Model Innovation
Brochure_EIC_Jan8_Public-1.pdf                                                 — EIC (Entrepreneurship & Innovation Center)
FUND I (MBA) - Hietaniemi - Fall 2025.pdf                                      — FUND I (Hietaniemi section)
FUND II - Syllabus v2025 12 05.docx                                            — FUND II source (already extracted to .txt)
FUND_II_Syllabus.txt                                                           — ALREADY EXTRACTED ✓
Fund of Ent Snihur MBA.pdf                                                     — FUND I (Snihur section)
MBA 2026 SEARCH 2 Syllabus_Fall Term.pdf                                       — SEARCH Course 2
MBA 2026 Search 1 Syllabus_Fall Term.pdf                                       — SEARCH Course 1
MBA 2026 Sports_Syllabus.pdf                                                   — Sports Management
MBA Corpent Fall Term 2026 _Updated September 2025.pdf                         — Corporate Entrepreneurship
MBA Masme 2026 AF updated Nov 11th.pdf                                         — African Experience (not FARO-relevant)
MBA-2026_ Winter Term_African Experience 2_Syllabus.pdf                        — African Experience (not FARO-relevant)
MBA-2026_ Winter Term_Corporate Governance and Family Business_Syllabus.pdf    — Corp Gov (not FARO-relevant)
MBA-2026_ Winter Term_Creativity and Laboratory of Ideas_Syllabus-3.pdf        — Creativity
MBA-2026_ Winter Term_Entrepreneurship New Ventures 2_Syllabus-2.pdf           — NAVEI (New Ventures)
MBA-2026_ Winter Term_Managing the Growing Business_Syllabus-1.pdf            — MGB (not primary FARO focus)
MBA-2026_ Winter Term_Managing the Growing Business_Syllabus.pdf               — MGB duplicate
MBA-2026_ Winter Term_Search Funds and Entrepreneurial Acquisitions 3_Syllabus.pdf — SEARCH Course 3
MBA-2026_ Winter Term_Sports Management 2_Syllabus.pdf                        — Sports Management 2
MBA-2027_ Nairobi_Fundamentals of Entrepreneurial Management-1_Syllabus.pdf   — FUND I (Nairobi)
Outline NAVEI 2025 FINAL.pdf                                                   — NAVEI 2025 outline
Outline NAVEI 2026 FINAL.pdf                                                   — NAVEI 2026 outline (most current)
Outline SEI Sust Ent Course July 1 Fall 2026 NEW.pdf                          — SEI (Social Entrepreneurship)
Syllabus Creativ Summer Term 25.pdf                                            — Creativity Summer Term
VCIC 2025 Outline FINAL.pdf                                                   — VCIC 2025 outline
```

### Syllabi to Extract for FARO (per FARO spec Tier 1 + Tier 2)

| Target File in `src/context/faro/` | Source PDF | FARO Tier | Priority |
|-------------------------------------|-----------|-----------|----------|
| `fund-ii-syllabus.txt` | FUND_II_Syllabus.txt (already extracted) | Tier 1 | CRITICAL |
| `fund-i-hietaniemi.txt` | `FUND I (MBA) - Hietaniemi - Fall 2025.pdf` | Tier 1 | HIGH |
| `fund-i-snihur.txt` | `Fund of Ent Snihur MBA.pdf` | Tier 1 | HIGH |
| `fund-i-nairobi.txt` | `MBA-2027_ Nairobi_Fundamentals of Entrepreneurial Management-1_Syllabus.pdf` | Tier 1 | HIGH |
| `navei.txt` | `Outline NAVEI 2026 FINAL.pdf` | Tier 2 | HIGH |
| `vcic.txt` | `VCIC 2025 Outline FINAL.pdf` | Tier 2 | HIGH |
| `search.txt` | `MBA 2026 Search 1 Syllabus_Fall Term.pdf` | Tier 2 | MEDIUM |
| `bmi.txt` | `BMI Syllabus 2025.pdf` | Tier 2 | MEDIUM |
| `bmc.txt` | `BMC 2025 Syllabus.pdf` | Tier 2 | LOW |
| `corporate-entrepreneurship.txt` | `MBA Corpent Fall Term 2026 _Updated September 2025.pdf` | Tier 2 | MEDIUM |
| `sei.txt` | `Outline SEI Sust Ent Course July 1 Fall 2026 NEW.pdf` | Tier 2 | LOW |
| `entrepreneurial-finance.txt` | `2025_07_Entrepreneurial Finance 1_2_final.pdf` | Tier 2 | MEDIUM |
| `creativity.txt` | `MBA-2026_ Winter Term_Creativity and Laboratory of Ideas_Syllabus-3.pdf` | Tier 2 | LOW |
| `sports.txt` | `MBA 2026 Sports_Syllabus.pdf` | Tier 2 | LOW |
| `eic.txt` | `Brochure_EIC_Jan8_Public-1.pdf` | Tier 2 | MEDIUM |

---

## Token Budget Analysis

### FARO Spec Token Estimate

The FARO spec (`FARO/FARO_Agent_Spec_v2.txt`) is ~990 lines of dense prose. Estimated tokens: **~12,000–15,000 tokens**.

The system prompt section (between `=== BEGIN SYSTEM PROMPT ===` and `=== END SYSTEM PROMPT ===`) is the relevant portion for injection — roughly lines 197–481, approximately **~5,000–6,000 tokens**. Only the system prompt section should be included in the agent's `system` parameter; the full spec document including sample conversations and KB spec is reference material, not runtime injection.

### FUND II Syllabus Token Estimate

`FUND_II_Syllabus.txt` is ~487 lines. At ~75 chars/line average, ~36,500 chars → approximately **~9,000 tokens** (GPT/Gemini tokenization: ~4 chars/token).

### Elective Syllabi Estimates

Typical MBA course syllabus PDF is 3–10 pages of text after extraction. Estimated per-elective:
- Short outlines (NAVEI, VCIC outline formats): ~2,000–4,000 tokens
- Full syllabi (SEARCH, BMI, Corp Ent, etc.): ~4,000–8,000 tokens
- Brief brochures (EIC): ~1,000–2,000 tokens

### Total Budget Calculation

| Component | Est. Tokens | Injected? |
|-----------|-------------|-----------|
| FARO system prompt (excerpt only) | ~5,500 | YES — as system instruction |
| FUND II Syllabus (full) | ~9,000 | YES — full text, Tier 1 CRITICAL |
| FUND I syllabi × 3 | ~6,000–9,000 | Condensed if needed |
| NAVEI + VCIC outlines | ~4,000–6,000 | Condensed if needed |
| SEARCH + BMI + Corp Ent | ~6,000–10,000 | Condensed |
| SEI + Entrepreneurial Finance + Creativity + Sports + EIC | ~5,000–8,000 | Condensed |
| **Total estimate** | **~35,000–47,000** | **Exceeds 30K budget** |

### Strategy: Tiered Injection with Summaries

Given that full injection will exceed the 30K token soft budget, use a two-tier approach:

**Always inject in full (Tier 1 — must be verbatim):**
- FARO system prompt section from spec (~5,500 tokens)
- FUND II Syllabus full text (~9,000 tokens)

**Inject as condensed summaries (Tier 2 — electives):**
Each elective summary format:
```
=== [ELECTIVE NAME] — [Professor] ===
Term: [Term offered]
Focus: [1-sentence description]
Key topics: [bullet list, max 5 items]
Why relevant: [1-sentence FUND II connection]
```
Target: ~200–400 tokens per elective × 13 electives ≈ **~3,000–5,000 tokens**

**Total with condensed Tier 2:** ~5,500 + 9,000 + ~4,000 = **~18,500 tokens** — well within budget.

**Context priority header** to be prepended:
```
[FARO KNOWLEDGE BASE — FUND II Course Navigator]
Consult the pre-loaded syllabi below BEFORE searching the web.
Tier 1 (FUND II Core) is your primary authority for all course questions.
Tier 2 (IESE Ecosystem) provides elective context for career guidance.
```

---

## urlContext Access Path (Verified)

From `node_modules/@ai-sdk/google-vertex/dist/index.d.ts`:

```typescript
declare const googleVertexTools: {
  googleSearch: ProviderToolFactory<{}, { ... }>;
  urlContext: ProviderToolFactory<{}, {}>;
  // ...
};

interface GoogleVertexProvider extends ProviderV3 {
  tools: typeof googleVertexTools;  // <-- vertex.tools.urlContext({}) is the path
}
```

**Confirmed syntax:**
```typescript
tools: {
  google_search: vertex.tools.googleSearch({}),
  url_context: vertex.tools.urlContext({}),
}
```

This matches the Trend Mapper's existing `vertex.tools.googleSearch({})` pattern exactly.

---

## Route Handler Architecture

FARO's route handler mirrors the Trend Mapper (`src/app/api/chat/[projectId]/route.ts`) with these differences:

| Aspect | Trend Mapper | FARO |
|--------|-------------|------|
| System context | `getSystemContext()` | `getFAROContext()` |
| agentType filter | `'trend-mapper'` | `'faro'` |
| Standard model | `gemini-2.5-flash` | `gemini-2.5-flash` |
| Standard tools | `{ google_search }` | `{ google_search }` |
| Deep research model | `gemini-2.5-pro` | `gemini-2.5-pro` |
| Deep research tools | `{ google_search, url_context }` | `{ google_search, url_context }` |
| POST body extras | `agentType`, `deepResearch` | `agentType`, `currentSession`, `deepResearch` |
| Session injection | Into system string | Into system string |

### Session Injection Pattern

```typescript
const systemContext = getFAROContext();
const sessionLine = `\n\n[Current FUND II Session: ${currentSession} of 10]`;
const fullSystem = systemContext + sessionLine;
```

---

## ChatWindow Routing Integration

Per Phase 6 Plan 06-03: the routing switch from `ChatWindow` to the correct endpoint is established in 06-03 when the VD and SPI routes are wired. FARO should be included in that same routing map. The switch logic pattern (established in 06-03):

```typescript
const AGENT_ENDPOINTS: Record<string, string> = {
  'trend-mapper': `/api/chat/${projectId}`,
  'value-designer': `/api/chat/value-designer/${projectId}`,
  'spi': `/api/chat/spi/${projectId}`,
  'faro': `/api/chat/faro/${projectId}`,   // <-- FARO adds this entry
};
```

Plan 07-02 adds the `faro` entry to this map (the map is defined in `ChatWindow.tsx` or similar, created in Phase 6).

---

## No New Dependencies Required

All required packages are already installed:
- `pdf-parse` — for extracting PDFs (already in package.json per PROJECT.md)
- `@ai-sdk/google-vertex` v4.0.93 — `vertex.tools.urlContext({})` confirmed available
- `ai` v6 — `streamText` pattern unchanged
- `fs` — for context file loading (Node.js built-in)

---

## Key Implementation Notes

1. **Extraction script**: A one-time Node.js script (`scripts/extract-faro-syllabi.ts`) using `pdf-parse` extracts each PDF. The script measures token count (chars / 4 as approximation) and auto-generates condensed summaries for Tier 2 documents. FUND II Syllabus is copied directly from the existing `.txt` file.

2. **`getFAROContext()` design**: Mirrors `getSystemContext()` in `src/lib/context.ts` — reads files synchronously from `src/context/faro/` at call time (not cached, consistent with existing pattern). Returns a single string: priority header + FARO system prompt + FUND II syllabus + Tier 2 summaries.

3. **`export const runtime = 'nodejs'`**: Required on all Vertex AI route handlers. The FARO route must include this at line 1.

4. **Deep research toggle availability**: Per ROADMAP.md and PROJECT.md, Deep Research is available for FARO (not VD/SPI). The `deepResearch` boolean in the POST body conditionally switches model to Pro + adds `url_context`.

5. **Phase dependency**: Plan 07-01 (context loader) must complete before Plan 07-02 (route handler) because the route handler imports `getFAROContext` from `src/lib/context.ts`.

---

*Research completed: 2026-03-21*
