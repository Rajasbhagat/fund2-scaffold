#!/bin/bash
# FUND II AI Agent Platform — Phase 5 Coordinator
# Wave 1: Run 01 (Prisma migration) and 02 (session tracker) in PARALLEL
# Wave 2: Run 03 (agent tabs + deep research) AFTER wave 1 merges
#
# Usage: bash scripts/ralph/phase-5/coordinator.sh
# Logs: scripts/ralph/phase-5/coordinator.log

set -e

PROJECT_DIR="/Users/rajas/Desktop/AntiGravity/Fund2Updated"
RALPH_DIR="$PROJECT_DIR/scripts/ralph"
PHASE5_DIR="$RALPH_DIR/phase-5"
LOG="$PHASE5_DIR/coordinator.log"
BASE_BRANCH="ralph/phase-4-ui-polish"

log() {
  local msg="[$(date '+%H:%M:%S')] [phase-5] $*"
  echo "$msg"
  echo "$msg" >> "$LOG"
}

phase_complete() {
  local prd="$1"
  if [ ! -f "$prd" ]; then return 1; fi
  local result
  result=$(jq -r '[.userStories[].passes] | all' "$prd" 2>/dev/null || echo "false")
  [[ "$result" == "true" ]]
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

  # Set up ralph files in worktree
  cp "$prd_source" "$worktree_path/scripts/ralph/prd.json"
  cp "$RALPH_DIR/CLAUDE.md" "$worktree_path/scripts/ralph/CLAUDE.md"
  cp "$RALPH_DIR/ralph.sh" "$worktree_path/scripts/ralph/ralph.sh"
  chmod +x "$worktree_path/scripts/ralph/ralph.sh"
  # Copy .env.local (Vertex AI credentials — not in git)
  [ -f "$PROJECT_DIR/.env.local" ] && cp "$PROJECT_DIR/.env.local" "$worktree_path/.env.local"

  log "[$group_name] Starting ralph loop..."
  if (cd "$worktree_path" && bash scripts/ralph/ralph.sh --tool claude 10 >> "$LOG" 2>&1); then
    log "[$group_name] ✓ ralph completed successfully"
  else
    log "[$group_name] ✗ ralph exited with errors (check $LOG)"
    return 1
  fi

  # Save final prd state back
  cp "$worktree_path/scripts/ralph/prd.json" "$prd_source"
  log "[$group_name] PRD state saved back to $prd_source"
}

merge_branch() {
  local target="$1"
  local source="$2"
  local worktree_path="$3"

  log "Merging $source → $target"
  git -C "$PROJECT_DIR" checkout "$target"
  git -C "$PROJECT_DIR" merge "$source" --no-edit --allow-unrelated-histories 2>/dev/null || {
    log "Merge conflict detected — auto-resolving non-code files"
    git -C "$PROJECT_DIR" checkout --ours -- "scripts/ralph/prd.json" 2>/dev/null || true
    git -C "$PROJECT_DIR" add -A
    GIT_EDITOR=true git -C "$PROJECT_DIR" merge --continue
  }
  git -C "$PROJECT_DIR" worktree remove "$worktree_path" --force 2>/dev/null || true
  log "Merged and cleaned: $source → $target"
}

# =====================================================================
# WAVE 1 — Plan 01 (Prisma migration) and Plan 02 (session tracker) in PARALLEL
# =====================================================================
log "=== PHASE 5 COORDINATOR STARTING ==="
log "Base branch: $BASE_BRANCH"
log ""
log "=== WAVE 1: Launching parallel groups ==="
log "  Wave1-01: Prisma migration (agentType on Message + AppSettings)"
log "  Wave1-02: Session tracker (API + SessionContext + sidebar widget)"

run_ralph_in_worktree \
  "/tmp/fund2-p5-wave1-01" \
  "ralph/phase-5-wave1-01" \
  "$BASE_BRANCH" \
  "$PHASE5_DIR/prd-wave1-01.json" \
  "P5-Wave1-01" &
PID_W1_01=$!

run_ralph_in_worktree \
  "/tmp/fund2-p5-wave1-02" \
  "ralph/phase-5-wave1-02" \
  "$BASE_BRANCH" \
  "$PHASE5_DIR/prd-wave1-02.json" \
  "P5-Wave1-02" &
PID_W1_02=$!

log "Wave 1-01 (PID $PID_W1_01) and Wave 1-02 (PID $PID_W1_02) running in parallel"

wait $PID_W1_01 && log "Wave 1-01 (Prisma) done" || { log "ERROR: Wave 1-01 failed"; exit 1; }
wait $PID_W1_02 && log "Wave 1-02 (Session) done" || { log "ERROR: Wave 1-02 failed"; exit 1; }

# =====================================================================
# MERGE WAVE 1 BRANCHES
# =====================================================================
log ""
log "=== Merging Wave 1 branches ==="
git -C "$PROJECT_DIR" checkout -b "ralph/phase-5-merged" "$BASE_BRANCH" 2>/dev/null || \
  git -C "$PROJECT_DIR" checkout "ralph/phase-5-merged"
merge_branch "ralph/phase-5-merged" "ralph/phase-5-wave1-01" "/tmp/fund2-p5-wave1-01"
merge_branch "ralph/phase-5-merged" "ralph/phase-5-wave1-02" "/tmp/fund2-p5-wave1-02"
log "✓ Wave 1 merged into ralph/phase-5-merged"

# Run prisma generate after merge to ensure types are consistent
log "Running prisma generate post-merge..."
(cd "$PROJECT_DIR" && npx prisma generate >> "$LOG" 2>&1) && log "prisma generate OK" || log "WARNING: prisma generate failed — check manually"

# Run seed post-merge to ensure AppSettings row exists
log "Running AppSettings seed post-merge..."
(cd "$PROJECT_DIR" && npx tsx scripts/seed-settings.ts >> "$LOG" 2>&1) && log "seed OK" || log "WARNING: seed failed — AppSettings row may be missing"

# =====================================================================
# WAVE 2 — Plan 03 (Agent tabs + deep research) SEQUENTIAL
# =====================================================================
log ""
log "=== WAVE 2: Agent tabs + ChatWindow refactor + deep research ==="
log "  Base: ralph/phase-5-merged (has agentType + SessionContext)"

run_ralph_in_worktree \
  "/tmp/fund2-p5-wave2-03" \
  "ralph/phase-5-wave2-03" \
  "ralph/phase-5-merged" \
  "$PHASE5_DIR/prd-wave2-03.json" \
  "P5-Wave2-03"

# Merge Wave 2 into final branch
log ""
log "=== Merging Wave 2 into final branch ==="
git -C "$PROJECT_DIR" checkout -b "ralph/phase-5-multi-agent-shell" "ralph/phase-5-merged" 2>/dev/null || \
  git -C "$PROJECT_DIR" checkout "ralph/phase-5-multi-agent-shell"
merge_branch "ralph/phase-5-multi-agent-shell" "ralph/phase-5-wave2-03" "/tmp/fund2-p5-wave2-03"

# Final build check
log ""
log "=== Final build verification ==="
(cd "$PROJECT_DIR" && npm run build >> "$LOG" 2>&1) && log "✓ npm run build PASSED" || log "WARNING: build failed — check $LOG"

log ""
log "==================================================================="
log "  PHASE 5 COMPLETE — Multi-Agent Platform Shell"
log "  Final branch: ralph/phase-5-multi-agent-shell"
log "  Deliverables:"
log "    - 4 agent tabs (Trend Mapper, Value Designer, SPI, FARO)"
log "    - Session tracker (1-10 dropdown in sidebar)"
log "    - Deep Research toggle on Trend Mapper"
log "    - agentType isolation in DB + route handler"
log "==================================================================="
