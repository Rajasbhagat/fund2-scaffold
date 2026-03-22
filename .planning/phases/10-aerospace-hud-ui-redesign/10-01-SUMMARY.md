---
phase: 10
plan: "01"
subsystem: design-system
tags: [fonts, tailwind-theme, hud-primitives, next-font]
dependency_graph:
  requires: []
  provides: [hud-tokens, hud-primitives, font-system]
  affects: [all-components]
tech_stack:
  added: [next/font/google, Rajdhani, JetBrains_Mono]
  patterns: [tailwind-v4-theme, css-variable-fonts, hud-primitive-components]
key_files:
  created:
    - src/components/hud/index.tsx
  modified:
    - app/layout.tsx
    - app/globals.css
decisions:
  - "Used Rajdhani as primary sans-serif with weight: ['300','400','500','600','700'] — required because Rajdhani is not a variable font"
  - "Used JetBrains_Mono with weight: 'variable' for the variable font axis"
  - "Added all 9 radius tokens (--radius through --radius-4xl) zeroed in @theme to enforce flat UI globally"
  - "Barcode component uses repeating-linear-gradient CSS approach (not span array) — lighter DOM"
  - "DotGrid children prop is optional (children?) to allow standalone background usage"
  - "body CSS fallback uses var(--bg-dark) = #1a2024 (dark) to match layout.tsx bg-hud-fg class"
metrics:
  duration: "~10 minutes"
  completed: "2026-03-22"
  tasks_completed: 2
  files_modified: 3
---

# Phase 10 Plan 01: Design Foundation — next/font, Tailwind v4 @theme HUD Tokens, HUD Primitive Library

**One-liner:** Wired Rajdhani + JetBrains Mono via next/font/google with CSS variables, added Tailwind v4 @theme block with HUD color tokens and zero-radius enforcement, and built 6 HUD primitive components in src/components/hud/index.tsx.

---

## What Was Done

### Task 1: Wire next/font/google Fonts + Tailwind v4 @theme Tokens

**app/layout.tsx:**
- Added `import { Rajdhani, JetBrains_Mono } from 'next/font/google'`
- Configured Rajdhani with `weight: ['300', '400', '500', '600', '700']` (required — non-variable font) and `display: 'swap'`
- Configured JetBrains_Mono with `weight: 'variable'` and `display: 'swap'`
- Both fonts inject CSS variables `--font-rajdhani` and `--font-jetbrains-mono` on `<html>` via `.variable` className
- Body uses `bg-hud-fg text-hud-bg font-sans` Tailwind token classes

**app/globals.css:**
- Removed `@import url('https://fonts.googleapis.com/...')` (replaced by next/font self-hosting)
- Added `@theme {}` block after `@import "tailwindcss"` with:
  - `--color-hud-bg: #d2edea` → utility class `bg-hud-bg`, `text-hud-bg`
  - `--color-hud-fg: #1a2024` → utility class `bg-hud-fg`, `text-hud-fg`
  - `--color-hud-accent: #ebff00` → utility class `bg-hud-accent`, `text-hud-accent`, `border-hud-accent`
  - `--color-hud-panel: #b1dbd8` → utility class `bg-hud-panel`, `text-hud-panel`, `border-hud-panel`
  - `--font-sans: var(--font-rajdhani), sans-serif` → wired to next/font CSS variable
  - `--font-mono: var(--font-jetbrains-mono), 'Courier New', monospace` → wired to next/font CSS variable
  - `--radius` through `--radius-4xl` all set to `0` → all `rounded-*` Tailwind classes resolve to 0 globally
- Kept `:root {}` block for backwards compatibility (CSS variables used in some inline styles)
- Updated `body` font-family CSS fallback to `var(--font-rajdhani), sans-serif`
- Updated `.mono` to use `var(--font-jetbrains-mono), 'Courier New', monospace`
- Preserved: `.dot-grid`, scrollbar styles, `prefers-reduced-motion` block

### Task 2: Build HUD Primitive Component Library

Created `src/components/hud/index.tsx` with 6 exported components:

| Component | Purpose | Key Classes |
|-----------|---------|-------------|
| `HUDPanel` | Bordered box with crosshair accent corners | `relative border border-hud-panel/20` + 4 absolute span corners |
| `HUDLabel` | Uppercase micro-copy (10px, tracked, muted) | `text-[10px] tracking-[0.2em] text-hud-panel/40 uppercase font-sans` |
| `HUDValue` | Large data display text | `text-2xl font-bold tracking-[0.05em] text-hud-bg font-sans` |
| `HUDAccentBlock` | Neon yellow block | `bg-hud-accent text-hud-fg px-4 py-2 font-sans` |
| `Barcode` | Decorative dense vertical lines | CSS `repeating-linear-gradient` via inline style |
| `DotGrid` | Perforated background wrapper | Uses existing `.dot-grid` CSS class |

All components use Tailwind v4 HUD token classes (no hardcoded hex values).

---

## Acceptance Criteria — All Met

- [x] `app/layout.tsx` contains `from 'next/font/google'`
- [x] `app/layout.tsx` contains `Rajdhani({` with `weight: ['300', '400', '500', '600', '700']`
- [x] `app/layout.tsx` contains `JetBrains_Mono({` with `variable: '--font-jetbrains-mono'`
- [x] `app/layout.tsx` `<html>` has `rajdhani.variable` and `jetbrainsMono.variable` in className
- [x] `app/layout.tsx` `<body>` has `bg-hud-fg text-hud-bg font-sans`
- [x] `app/globals.css` does NOT contain `@import url('https://fonts.googleapis.com`
- [x] `app/globals.css` contains `@theme {`
- [x] `app/globals.css` contains `--color-hud-bg: #d2edea;`
- [x] `app/globals.css` contains `--color-hud-fg: #1a2024;`
- [x] `app/globals.css` contains `--color-hud-accent: #ebff00;`
- [x] `app/globals.css` contains `--color-hud-panel: #b1dbd8;`
- [x] `app/globals.css` contains `--font-sans: var(--font-rajdhani)`
- [x] `app/globals.css` contains `--radius: 0;`
- [x] `app/globals.css` does NOT contain `Space Grotesk`
- [x] `src/components/hud/index.tsx` exports: HUDPanel, HUDLabel, HUDValue, HUDAccentBlock, Barcode, DotGrid
- [x] HUDPanel has `accentCorners` prop with default `true`
- [x] DotGrid uses `dot-grid` CSS class
- [x] `npx next build` passes cleanly
- [x] `npx tsc --noEmit` passes

---

## Verification Results

```
npx next build  → Compiled successfully in 1867ms, all 5 static pages generated
npx tsc --noEmit → No output (zero errors)
grep -c '@import url' app/globals.css → 0
grep -c '@theme' app/globals.css → 1
grep -c 'next/font/google' app/layout.tsx → 1
grep -c 'export function' src/components/hud/index.tsx → 6
```

---

## Deviations from Plan

None — plan executed exactly as written.

The files already had some prior work (`app/layout.tsx` had next/font partially configured, `app/globals.css` had a partial @theme block, `src/components/hud/index.tsx` had components but with different props/classes). All files were brought to full compliance with the plan spec:
- Added `display: 'swap'` to both font configs
- Added all 9 `--radius-*` tokens (only `--radius: 0` existed before)
- Updated `--font-mono` fallback to include `'Courier New'`
- Rewrote HUDLabel to include `text-hud-panel/40`
- Rewrote HUDValue to match spec (`text-2xl font-bold tracking-[0.05em] text-hud-bg font-sans`)
- Rewrote HUDAccentBlock to include `px-4 py-2 font-sans`
- Replaced complex Barcode span-array with `repeating-linear-gradient` CSS approach
- Made DotGrid `children` optional (`children?`)

---

## Known Stubs

None. All components render functional output. No placeholder data, TODO comments, or empty return values.

---

## Self-Check: PASSED

Files verified:
- FOUND: app/layout.tsx
- FOUND: app/globals.css
- FOUND: src/components/hud/index.tsx

Commit verified:
- FOUND: 27410b5 — feat: [10-01] Design foundation — next/font, Tailwind v4 @theme HUD tokens, HUD primitive library
