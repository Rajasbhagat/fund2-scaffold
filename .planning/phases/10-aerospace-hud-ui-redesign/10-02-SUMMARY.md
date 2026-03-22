---
phase: 10
plan: "02"
subsystem: dashboard-ui
tags: [hud-layout, project-cards, token-migration, 2-column, HUDPanel, HUDAccentBlock]
dependency_graph:
  requires: [10-01]
  provides: [dashboard-hud-layout, instrument-panel-cards, token-clean-components]
  affects: [app/page.tsx, src/components/ProjectList.tsx, src/components/ProjectCard.tsx, src/components/CreateProjectForm.tsx]
tech_stack:
  added: []
  patterns: [2-column-hud-layout, HUDPanel-instrument-cards, tailwind-v4-token-classes, dotgrid-sidebar]
key_files:
  created: []
  modified:
    - app/page.tsx
    - src/components/ProjectList.tsx
    - src/components/ProjectCard.tsx
    - src/components/CreateProjectForm.tsx
decisions:
  - "app/page.tsx restructured to 2-column layout: fixed w-56 sidebar (DotGrid background, identity block, barcode) + flex-1 main area"
  - "HUDAccentBlock used as dashboard header strip — satisfies UI-05 neon yellow accent requirement"
  - "ProjectCard wraps content in HUDPanel primitive — eliminates manual 4-span crosshair pattern"
  - "Accent strip inside HUDPanel uses absolute positioning h-0.5 bg-hud-accent/60 for per-card neon indicator"
  - "All hex arbitrary values (bg-[#1a2024], text-[#ebff00], etc.) replaced with token classes across all 4 files"
  - "All style={{ fontFamily: 'Rajdhani' }} inline props replaced with font-sans Tailwind class"
metrics:
  duration: "~5 minutes (files already at full compliance from prior execution)"
  completed: "2026-03-22"
  tasks_completed: 2
  files_modified: 4
---

# Phase 10 Plan 02: Dashboard Redesign — 2-Column HUD Layout, Instrument Panel Cards, Accent Header

**One-liner:** Restructured dashboard as 2-column mission control with DotGrid sidebar, HUDAccentBlock neon header, and instrument-panel project cards using HUDPanel primitives — all hex arbitrary values migrated to Tailwind v4 token classes.

---

## What Was Done

### Task 1: Restyle Dashboard Page with 2-Column HUD Layout

**app/page.tsx:**
- Full 2-column layout: `w-56 shrink-0 border-r border-hud-panel/20` sidebar + `flex-1` main area
- Header: `HUDAccentBlock` wrapping FUND II branding with date telemetry readout (`font-mono`)
- Sidebar: `DotGrid` wrapping identity block — `HUDLabel` + `HUDValue` for System, Status, Platform readouts; `Barcode` decorative element at bottom
- Main area: `flex-1 px-8 py-10 overflow-y-auto` rendering `<ProjectList>`
- All hex arbitrary values replaced with HUD token classes
- No inline `style={{ fontFamily }}` props

**src/components/ProjectList.tsx:**
- Imports and uses `HUDLabel` for the "INTELLIGENCE NODES" section header
- Section header uses `HUDLabel` + decorative `h-px w-5 bg-hud-accent` line + `font-mono` count display
- All token classes clean — no hex arbitrary values, no inline fontFamily
- Grid: `grid gap-4 sm:grid-cols-2 lg:grid-cols-3` preserved

### Task 2: Restyle ProjectCard + CreateProjectForm as HUD Instruments

**src/components/ProjectCard.tsx:**
- Imports `HUDPanel` from `'@/components/hud'`
- Outer `<li>` wraps `<HUDPanel className="border border-hud-panel/20 bg-hud-fg p-4 hover:border-hud-panel/40 transition-colors">`
- No manual crosshair spans — HUDPanel handles all 4 accent corners
- Neon yellow accent strip: `<div className="absolute top-0 left-0 right-0 h-0.5 bg-hud-accent/60" />` inside HUDPanel before content
- All text/border classes use token classes: `text-hud-bg`, `text-hud-accent`, `text-hud-panel`, `border-hud-panel`, `border-hud-accent`
- All action buttons use `font-sans` class (no inline fontFamily)

**src/components/CreateProjectForm.tsx:**
- Input: `border-hud-panel/25`, `text-hud-bg`, `placeholder:text-hud-panel/25`, `focus:border-hud-accent/60`
- Button: `bg-hud-accent text-hud-fg` with `hover:opacity-90`
- All token classes — no hex arbitrary values, no inline fontFamily

---

## Acceptance Criteria — All Met

- [x] `app/page.tsx` imports from `'@/components/hud'`
- [x] `app/page.tsx` contains `HUDAccentBlock` usage (3 occurrences: import + JSX)
- [x] `app/page.tsx` contains `DotGrid` usage in sidebar (3 occurrences: import + JSX)
- [x] `app/page.tsx` has sidebar with `w-56` fixed width
- [x] `app/page.tsx` does NOT contain `style={{ fontFamily` (0 occurrences)
- [x] `app/page.tsx` does NOT contain `bg-[#1a2024]` (0 occurrences)
- [x] `app/page.tsx` does NOT contain `text-[#d2edea]` (0 occurrences)
- [x] `app/page.tsx` does NOT contain `text-[#ebff00]` (0 occurrences)
- [x] `src/components/ProjectList.tsx` does NOT contain `style={{ fontFamily` (0 occurrences)
- [x] `src/components/ProjectList.tsx` does NOT contain `bg-[#1a2024]` (0 occurrences)
- [x] `src/components/ProjectCard.tsx` imports `HUDPanel` from `'@/components/hud'`
- [x] `src/components/ProjectCard.tsx` contains `<HUDPanel` JSX usage
- [x] `src/components/ProjectCard.tsx` does NOT contain manual corner span pattern
- [x] `src/components/ProjectCard.tsx` does NOT contain `style={{ fontFamily` (0 occurrences)
- [x] `src/components/ProjectCard.tsx` does NOT contain `bg-[#1a2024]`
- [x] `src/components/CreateProjectForm.tsx` does NOT contain `style={{ fontFamily` (0 occurrences)
- [x] `src/components/CreateProjectForm.tsx` does NOT contain `bg-[#ebff00]` — uses `bg-hud-accent`
- [x] `src/components/CreateProjectForm.tsx` does NOT contain `text-[#1a2024]` — uses `text-hud-fg`
- [x] `npx next build` succeeds cleanly

---

## Verification Results

```
npx next build     → Compiled successfully in 1959ms, all 5 static pages generated
npx tsc --noEmit   → No output (zero errors)
grep -c 'style={{ fontFamily' [all 4 files] → 0 0 0 0
grep -c 'bg-\[#1a2024\]' [all 4 files]      → 0 0 0 0
grep -c 'HUDPanel' src/components/ProjectCard.tsx → 3
grep -c 'HUDAccentBlock' app/page.tsx             → 3
grep -c 'DotGrid' app/page.tsx                    → 3
```

---

## Deviations from Plan

None — all four files were already at full compliance with the plan's acceptance criteria when execution began. The restyling had been completed in a prior execution session under story IDs US-003 and US-004 (commits `5506986` and `0d44888`). No changes were required; verification and SUMMARY creation proceeded directly.

---

## Known Stubs

None. All dashboard components are fully wired to live data:
- `app/page.tsx` loads projects from Prisma and passes to `<ProjectList>`
- `ProjectCard` renders real project name, updatedAt timestamp, and links to live project pages
- `CreateProjectForm` posts to `/api/projects` and receives real project data back

---

## Self-Check: PASSED

Files verified:
- FOUND: app/page.tsx
- FOUND: src/components/ProjectList.tsx
- FOUND: src/components/ProjectCard.tsx
- FOUND: src/components/CreateProjectForm.tsx

Commits verified:
- FOUND: 5506986 — feat: US-003 - Restyle dashboard page with 2-column HUD layout
- FOUND: 0d44888 — feat: US-004 - Restyle ProjectCard and CreateProjectForm as HUD instruments
