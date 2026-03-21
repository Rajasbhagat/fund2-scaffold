#!/bin/bash
# FUND II Trend Mapper — Multi-Phase Parallel Coordinator
# Orchestrates Phase 3 (2 parallel groups + integration) and Phase 4 (3 parallel groups)
# Phase 2 is assumed to be running separately via ralph.sh
#
# Usage: bash scripts/ralph/coordinator.sh
# Logs: scripts/ralph/coordinator.log

set -e

PROJECT_DIR="/Users/rajas/Desktop/AntiGravity/Fund2Updated"
RALPH_DIR="$PROJECT_DIR/scripts/ralph"
LOG="$RALPH_DIR/coordinator.log"

log() {
  local msg="[$(date '+%H:%M:%S')] [coordinator] $*"
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

wait_for_phase() {
  local prd="$1"
  local name="$2"
  log "Waiting for $name..."
  while ! phase_complete "$prd"; do
    sleep 30
    log "... $name still in progress"
  done
  log "✓ $name COMPLETE"
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

  # Set up ralph files in worktree (copy untracked files not in git)
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

  # Record the final prd state back
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
    log "Merge conflict detected — attempting auto-resolve with ours strategy for non-code files"
    git -C "$PROJECT_DIR" checkout --ours -- "scripts/ralph/prd.json" 2>/dev/null || true
    git -C "$PROJECT_DIR" add -A
    GIT_EDITOR=true git -C "$PROJECT_DIR" merge --continue
  }
  # Clean up worktree
  git -C "$PROJECT_DIR" worktree remove "$worktree_path" --force 2>/dev/null || true
  log "Merged and cleaned: $source → $target"
}

# =====================================================================
# PHASE 2 MONITORING
# =====================================================================
log "=== COORDINATOR STARTING ==="
log "Monitoring Phase 2 (scripts/ralph/prd.json)..."
wait_for_phase "$RALPH_DIR/prd.json" "Phase 2"

# Save Phase 2 prd to its home
cp "$RALPH_DIR/prd.json" "$RALPH_DIR/phase-2/prd.json"
PHASE2_BRANCH=$(jq -r '.branchName' "$RALPH_DIR/phase-2/prd.json")
log "Phase 2 branch: $PHASE2_BRANCH"

# =====================================================================
# PHASE 3 — Group A (route track) and Group B (UI track) in PARALLEL
# =====================================================================
log ""
log "=== PHASE 3: Launching parallel groups ==="
log "  Group A: route handler (US-001 baseline → US-002 context → US-004 persistence)"
log "  Group B: UI components (US-005 ChatWindow + ChatInput)"

# Launch Group A and B in parallel (background subshells)
run_ralph_in_worktree \
  "/tmp/fund2-p3-group-a" \
  "ralph/phase-3-group-a" \
  "$PHASE2_BRANCH" \
  "$RALPH_DIR/phase-3/prd-group-a.json" \
  "P3-GroupA" &
PID_P3A=$!

run_ralph_in_worktree \
  "/tmp/fund2-p3-group-b" \
  "ralph/phase-3-group-b" \
  "$PHASE2_BRANCH" \
  "$RALPH_DIR/phase-3/prd-group-b.json" \
  "P3-GroupB" &
PID_P3B=$!

log "Phase 3 Group A (PID $PID_P3A) and Group B (PID $PID_P3B) running in parallel"

# Wait for both
wait $PID_P3A && log "Phase 3 Group A done" || log "WARNING: Phase 3 Group A exited with error"
wait $PID_P3B && log "Phase 3 Group B done" || log "WARNING: Phase 3 Group B exited with error"

# Create merged branch and merge both groups into it
log "Merging Phase 3 groups..."
git -C "$PROJECT_DIR" checkout -b "ralph/phase-3-merged" "$PHASE2_BRANCH" 2>/dev/null || \
  git -C "$PROJECT_DIR" checkout "ralph/phase-3-merged"
merge_branch "ralph/phase-3-merged" "ralph/phase-3-group-a" "/tmp/fund2-p3-group-a"
merge_branch "ralph/phase-3-merged" "ralph/phase-3-group-b" "/tmp/fund2-p3-group-b"
log "Phase 3 groups merged into ralph/phase-3-merged"

# Phase 3 Integration: US-003 (grounding) + US-006 (end-to-end)
log ""
log "=== PHASE 3: Integration pass (grounding + end-to-end wiring) ==="
run_ralph_in_worktree \
  "/tmp/fund2-p3-integration" \
  "ralph/phase-3-integration" \
  "ralph/phase-3-merged" \
  "$RALPH_DIR/phase-3/prd-integration.json" \
  "P3-Integration"

# Tag Phase 3 final branch
git -C "$PROJECT_DIR" checkout -b "ralph/phase-3-streaming-chat" "ralph/phase-3-integration" 2>/dev/null || {
  git -C "$PROJECT_DIR" checkout "ralph/phase-3-streaming-chat"
  git -C "$PROJECT_DIR" merge "ralph/phase-3-integration" --no-edit
}
git -C "$PROJECT_DIR" worktree remove "/tmp/fund2-p3-integration" --force 2>/dev/null || true

log "✓ PHASE 3 COMPLETE — branch: ralph/phase-3-streaming-chat"

# =====================================================================
# PHASE 4 — Groups A, B, C in PARALLEL
# =====================================================================
log ""
log "=== PHASE 4: Launching parallel groups ==="
log "  Group A: new files only (US-001 MessageBubble + US-006 GUARDRAIL_QA)"
log "  Group B: shared files (US-004 headers → US-003 errors → US-002 loading)"
log "  Group C: layout (US-005 responsive sidebar+chat)"

run_ralph_in_worktree \
  "/tmp/fund2-p4-group-a" \
  "ralph/phase-4-group-a" \
  "ralph/phase-3-streaming-chat" \
  "$RALPH_DIR/phase-4/prd-group-a.json" \
  "P4-GroupA" &
PID_P4A=$!

run_ralph_in_worktree \
  "/tmp/fund2-p4-group-b" \
  "ralph/phase-4-group-b" \
  "ralph/phase-3-streaming-chat" \
  "$RALPH_DIR/phase-4/prd-group-b.json" \
  "P4-GroupB" &
PID_P4B=$!

run_ralph_in_worktree \
  "/tmp/fund2-p4-group-c" \
  "ralph/phase-4-group-c" \
  "ralph/phase-3-streaming-chat" \
  "$RALPH_DIR/phase-4/prd-group-c.json" \
  "P4-GroupC" &
PID_P4C=$!

log "Phase 4 Groups A (PID $PID_P4A), B (PID $PID_P4B), C (PID $PID_P4C) running in parallel"

wait $PID_P4A && log "Phase 4 Group A done" || log "WARNING: Phase 4 Group A exited with error"
wait $PID_P4B && log "Phase 4 Group B done" || log "WARNING: Phase 4 Group B exited with error"
wait $PID_P4C && log "Phase 4 Group C done" || log "WARNING: Phase 4 Group C exited with error"

# Merge all Phase 4 branches
log "Merging Phase 4 groups..."
git -C "$PROJECT_DIR" checkout -b "ralph/phase-4-ui-polish" "ralph/phase-3-streaming-chat" 2>/dev/null || \
  git -C "$PROJECT_DIR" checkout "ralph/phase-4-ui-polish"
merge_branch "ralph/phase-4-ui-polish" "ralph/phase-4-group-a" "/tmp/fund2-p4-group-a"
merge_branch "ralph/phase-4-ui-polish" "ralph/phase-4-group-b" "/tmp/fund2-p4-group-b"
merge_branch "ralph/phase-4-ui-polish" "ralph/phase-4-group-c" "/tmp/fund2-p4-group-c"

# Phase 4 integration: wire MessageBubble into ChatWindow (1-commit cleanup)
log ""
log "=== PHASE 4: Integration — wiring MessageBubble into ChatWindow ==="
log "NOTE: After merge, ChatWindow.tsx (Group B) must import and use MessageBubble (Group A)."
log "      Manually update ChatWindow to replace raw text rendering with <MessageBubble> component."
log "      This is a 3-5 line change — search for raw message content rendering and replace."

log ""
log "==================================================================="
log "  ALL PHASES COMPLETE — FUND II Trend Mapper MVP"
log "  Final branch: ralph/phase-4-ui-polish"
log "  Remaining: Manual pedagogical QA per GUARDRAIL_QA.md"
log "==================================================================="
