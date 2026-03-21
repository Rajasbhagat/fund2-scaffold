# Ralph Agent Instructions

You are an autonomous coding agent building the FUND II Trend Mapper — a Next.js 14 web app for MBA students at IESE Business School. Each project has a persistent AI chat with a Trend Mapper agent powered by Vertex AI Gemini.

## Your Task

1. Read the PRD at `scripts/ralph/prd.json`
2. Read the progress log at `scripts/ralph/progress.txt` (check Codebase Patterns section first)
3. Check you're on the correct branch from PRD `branchName`. If not, check it out or create from main.
4. Pick the **highest priority** user story where `passes: false`
5. Implement that single user story
6. Run quality checks (`npm run build` or `npx tsc --noEmit` for typecheck)
7. Update CLAUDE.md files if you discover reusable patterns
8. If checks pass, commit ALL changes with message: `feat: [Story ID] - [Story Title]`
9. Update the PRD to set `passes: true` for the completed story
10. Append your progress to `scripts/ralph/progress.txt`

## Project Context

- **Stack**: Next.js 14 App Router, TypeScript, Tailwind CSS, Prisma + SQLite, Vertex AI Gemini
- **Working directory**: `/Users/rajas/Desktop/AntiGravity/Fund2Updated`
- **Agent spec**: `Trend Mapper/FUND_II_Trend_Mapper_System_Prompt.txt` — do not modify
- **Megatrend docs**: `Trend Mapper/MEGATRENDS Docs for TrendMapper/`
- **Critical**: All Vertex AI Route Handlers MUST have `export const runtime = 'nodejs'` — never edge runtime
- **Critical**: Prisma must use the global singleton pattern to avoid hot-reload connection exhaustion

## Progress Report Format

APPEND to `scripts/ralph/progress.txt` (never replace, always append):
```
## [Date/Time] - [Story ID]
- What was implemented
- Files changed
- **Learnings for future iterations:**
  - Patterns discovered
  - Gotchas encountered
  - Useful context
---
```

## Consolidate Patterns

If you discover a reusable pattern, add it to `## Codebase Patterns` at the TOP of progress.txt:

```
## Codebase Patterns
- All Vertex AI routes use `export const runtime = 'nodejs'`
- Prisma client imported from `@/lib/prisma` (singleton)
- Context loaded via `getSystemContext()` from `@/lib/context`
```

## Quality Requirements

- Run `npx tsc --noEmit` to typecheck before committing
- Do NOT commit broken code
- Keep changes focused and minimal — one story at a time

## Browser Testing

For UI stories (marked with "Verify in browser using dev-browser skill"):
1. Start dev server if not running: `npm run dev`
2. Navigate to the relevant page
3. Verify the changes work as expected

## Stop Condition

After completing a user story, check if ALL stories have `passes: true`.

If ALL stories are complete: reply with `<promise>COMPLETE</promise>`

If stories remain: end normally (next iteration picks up the next story).

## Important

- Work on ONE story per iteration
- Commit after each story
- The working directory is `/Users/rajas/Desktop/AntiGravity/Fund2Updated` — all paths are relative to this
