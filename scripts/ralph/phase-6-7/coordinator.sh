#!/bin/bash
# FUND II AI Agent Platform — Phase 6 & 7 Coordinator
# Phase 6 (Value Designer + SPI) and Phase 7 (FARO) run in parallel from Phase 5 base
# Within Phase 6: Wave 1 (context extraction) → Wave 2 parallel (VD route + SPI route+routing)
# Within Phase 7: Wave 1 (syllabi extraction) → Wave 2 (FARO route handler)
#
# Usage: bash scripts/ralph/phase-6-7/coordinator.sh
# Logs: scripts/ralph/phase-6-7/coordinator.log

set -e

PROJECT_DIR="/Users/rajas/Desktop/AntiGravity/Fund2Updated"
RALPH_DIR="$PROJECT_DIR/scripts/ralph"
PHASE6_DIR="$RALPH_DIR/phase-6"
PHASE7_DIR="$RALPH_DIR/phase-7"
LOG="$RALPH_DIR/phase-6-7/coordinator.log"
BASE_BRANCH="ralph/phase-5-multi-agent-shell"

log() {
  local msg="[$(date '+%H:%M:%S')] [phase-6-7] $*"
  echo "$msg"
  echo "$msg" >> "$LOG"
}

run_ralph_in_worktree() {
  local worktree_path="$1"
  local branch_name="$2"
  local base_branch="$3"
  local prd_source="$4"
  local group_name="$5"

  log "[$group_name] Creating worktree at $worktree_path from $base_branch"
  rm -rf "$worktree_path"
  git -C "$PROJECT_DIR" worktree add "$worktree_path" -b "$branch_name" "$base_branch" 2>/dev/null || {
    git -C "$PROJECT_DIR" branch -D "$branch_name" 2>/dev/null || true
    git -C "$PROJECT_DIR" worktree add "$worktree_path" -b "$branch_name" "$base_branch"
  }

  cp "$prd_source" "$worktree_path/scripts/ralph/prd.json"
  cp "$RALPH_DIR/CLAUDE.md" "$worktree_path/scripts/ralph/CLAUDE.md"
  cp "$RALPH_DIR/ralph.sh" "$worktree_path/scripts/ralph/ralph.sh"
  chmod +x "$worktree_path/scripts/ralph/ralph.sh"
  [ -f "$PROJECT_DIR/.env.local" ] && cp "$PROJECT_DIR/.env.local" "$worktree_path/.env.local"

  log "[$group_name] Starting ralph loop..."
  if (cd "$worktree_path" && bash scripts/ralph/ralph.sh --tool claude 10 >> "$LOG" 2>&1); then
    log "[$group_name] ✓ ralph completed successfully"
  else
    log "[$group_name] ✗ ralph exited with errors (check $LOG)"
    return 1
  fi

  cp "$worktree_path/scripts/ralph/prd.json" "$prd_source"
  log "[$group_name] PRD state saved back to $prd_source"
}

merge_worktree() {
  local target="$1"
  local source_branch="$2"
  local worktree_path="$3"

  log "Merging $source_branch → $target"
  git -C "$PROJECT_DIR" checkout "$target"
  if ! git -C "$PROJECT_DIR" merge "$source_branch" --no-edit 2>/dev/null; then
    git -C "$PROJECT_DIR" checkout --ours -- "scripts/ralph/prd.json" "scripts/ralph/progress.txt" 2>/dev/null || true
    git -C "$PROJECT_DIR" add -A
    GIT_EDITOR=true git -C "$PROJECT_DIR" merge --continue
  fi
  git -C "$PROJECT_DIR" worktree remove "$worktree_path" --force 2>/dev/null || true
  log "✓ Merged and cleaned: $source_branch → $target"
}

mkdir -p "$RALPH_DIR/phase-6-7"

log "=== PHASE 6 + 7 COORDINATOR STARTING ==="
log "Base branch: $BASE_BRANCH"

# =====================================================================
# PHASE 6 — Wave 1 (context extraction) THEN Wave 2 parallel (VD + SPI)
# PHASE 7 — Wave 1 (syllabi) THEN Wave 2 (FARO route) — runs in parallel with Phase 6
# =====================================================================

# --- PHASE 6 WAVE 1 ---
log ""
log "=== PHASE 6 Wave 1: Context extraction (VD + SPI prompts) ==="
run_ralph_in_worktree \
  "/tmp/fund2-p6-wave1-01" \
  "ralph/phase-6-wave1-01" \
  "$BASE_BRANCH" \
  "$PHASE6_DIR/prd-wave1-01.json" \
  "P6-W1-01"

# Create phase-6-merged from wave1-01
log "Creating ralph/phase-6-merged from wave1-01..."
git -C "$PROJECT_DIR" checkout -b "ralph/phase-6-merged" "ralph/phase-6-wave1-01" 2>/dev/null || {
  git -C "$PROJECT_DIR" checkout "ralph/phase-6-merged"
  git -C "$PROJECT_DIR" merge "ralph/phase-6-wave1-01" --no-edit
}
git -C "$PROJECT_DIR" worktree remove "/tmp/fund2-p6-wave1-01" --force 2>/dev/null || true
log "✓ Phase 6 Wave 1 done, merged into ralph/phase-6-merged"

# --- PHASE 7 WAVE 1 (runs right after P6 W1 to avoid blocking) ---
log ""
log "=== PHASE 7 Wave 1: FARO syllabi extraction ==="
run_ralph_in_worktree \
  "/tmp/fund2-p7-wave1-01" \
  "ralph/phase-7-wave1-01" \
  "$BASE_BRANCH" \
  "$PHASE7_DIR/prd-wave1-01.json" \
  "P7-W1-01" &
PID_P7W1=$!

# --- PHASE 6 WAVE 2 — VD route + SPI route in PARALLEL ---
log ""
log "=== PHASE 6 Wave 2: VD route + SPI route (parallel) ==="
run_ralph_in_worktree \
  "/tmp/fund2-p6-wave2-02" \
  "ralph/phase-6-wave2-02" \
  "ralph/phase-6-merged" \
  "$PHASE6_DIR/prd-wave2-02.json" \
  "P6-W2-02" &
PID_P6W2_02=$!

run_ralph_in_worktree \
  "/tmp/fund2-p6-wave2-03" \
  "ralph/phase-6-wave2-03" \
  "ralph/phase-6-merged" \
  "$PHASE6_DIR/prd-wave2-03.json" \
  "P6-W2-03" &
PID_P6W2_03=$!

log "Phase 6 Wave 2: VD (PID $PID_P6W2_02) + SPI (PID $PID_P6W2_03) running in parallel"
log "Phase 7 Wave 1: syllabi extraction (PID $PID_P7W1) running in parallel"

wait $PID_P6W2_02 && log "P6-W2-02 (VD route) done" || { log "ERROR: P6-W2-02 failed"; exit 1; }
wait $PID_P6W2_03 && log "P6-W2-03 (SPI+routing) done" || { log "ERROR: P6-W2-03 failed"; exit 1; }
wait $PID_P7W1 && log "P7-W1-01 (syllabi) done" || { log "ERROR: P7-W1-01 failed"; exit 1; }

# Merge Phase 6 Wave 2 branches
log ""
log "=== Merging Phase 6 Wave 2 branches ==="
merge_worktree "ralph/phase-6-merged" "ralph/phase-6-wave2-02" "/tmp/fund2-p6-wave2-02"
merge_worktree "ralph/phase-6-merged" "ralph/phase-6-wave2-03" "/tmp/fund2-p6-wave2-03"

# Create final Phase 6 branch
git -C "$PROJECT_DIR" checkout -b "ralph/phase-6-final" "ralph/phase-6-merged" 2>/dev/null || {
  git -C "$PROJECT_DIR" checkout "ralph/phase-6-final"
  git -C "$PROJECT_DIR" merge "ralph/phase-6-merged" --no-edit
}
log "✓ PHASE 6 COMPLETE — branch: ralph/phase-6-final"

# --- PHASE 7 WAVE 2 --- (starts after Wave 1 finished above)
log ""
log "=== PHASE 7 Wave 2: FARO route handler ==="

# Create phase-7-merged from wave1-01
git -C "$PROJECT_DIR" checkout -b "ralph/phase-7-merged" "ralph/phase-7-wave1-01" 2>/dev/null || {
  git -C "$PROJECT_DIR" checkout "ralph/phase-7-merged"
  git -C "$PROJECT_DIR" merge "ralph/phase-7-wave1-01" --no-edit
}
git -C "$PROJECT_DIR" worktree remove "/tmp/fund2-p7-wave1-01" --force 2>/dev/null || true

run_ralph_in_worktree \
  "/tmp/fund2-p7-wave2-02" \
  "ralph/phase-7-wave2-02" \
  "ralph/phase-7-merged" \
  "$PHASE7_DIR/prd-wave2-02.json" \
  "P7-W2-02"

merge_worktree "ralph/phase-7-merged" "ralph/phase-7-wave2-02" "/tmp/fund2-p7-wave2-02"

git -C "$PROJECT_DIR" checkout -b "ralph/phase-7-final" "ralph/phase-7-merged" 2>/dev/null || {
  git -C "$PROJECT_DIR" checkout "ralph/phase-7-final"
  git -C "$PROJECT_DIR" merge "ralph/phase-7-merged" --no-edit
}
log "✓ PHASE 7 COMPLETE — branch: ralph/phase-7-final"

log ""
log "==================================================================="
log "  PHASES 6 + 7 COMPLETE"
log "  Phase 6 final: ralph/phase-6-final"
log "  Phase 7 final: ralph/phase-7-final"
log "  Next: merge both into a combined branch, then execute Phase 8"
log "==================================================================="
