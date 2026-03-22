'use client'

import type { UnifiedMessage } from '@/components/UnifiedChatWindow'
import {
  computeAgentProgress,
  computeNextStep,
  type AgentProgress,
} from '@/lib/progress/milestones'

// ── Agent card ────────────────────────────────────────────────────────────────

function AgentCard({ progress }: { progress: AgentProgress }) {
  const completedCount = progress.milestones.filter((m) => m.completed).length
  const totalCount = progress.milestones.length
  const hasStarted = progress.assistantMessages > 0

  return (
    <div className="border-b border-hud-fg/10 px-3 py-2.5">
      {/* Agent header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-hud-fg/70">
          {progress.label}
        </span>
        <span className="text-[9px] font-mono text-hud-fg/40 tabular-nums">
          {progress.assistantMessages} MSGS
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-px bg-hud-fg/10 mb-2">
        {totalCount > 0 && (
          <div
            className="h-px bg-hud-accent transition-all duration-500"
            style={{ width: `${(completedCount / totalCount) * 100}%` }}
          />
        )}
      </div>

      {/* Milestones */}
      <div className="flex flex-col gap-0.5 mb-2">
        {progress.milestones.map((m) => (
          <div key={m.id} className="flex items-start gap-1.5">
            <span
              className={`text-[11px] leading-none mt-[1px] shrink-0 ${
                m.completed ? 'text-hud-accent' : 'text-hud-fg/25'
              }`}
            >
              {m.completed ? '✓' : '○'}
            </span>
            <span
              className={`text-[10px] font-mono leading-snug ${
                m.completed ? 'text-hud-fg/70' : 'text-hud-fg/35'
              }`}
            >
              {m.label}
            </span>
          </div>
        ))}
      </div>

      {/* Recent topics */}
      {hasStarted && progress.recentTopics.length > 0 && (
        <details className="mt-1">
          <summary className="text-[9px] font-mono tracking-widest uppercase text-hud-fg/40 cursor-pointer list-none select-none hover:text-hud-fg/60 transition-colors">
            ▸ RECENT TOPICS
          </summary>
          <div className="mt-1 flex flex-col gap-0.5 pl-2 border-l border-hud-fg/10">
            {progress.recentTopics.map((topic, i) => (
              <p key={i} className="text-[9px] font-mono text-hud-fg/50 leading-relaxed">
                — {topic}{topic.length === 60 ? '…' : ''}
              </p>
            ))}
          </div>
        </details>
      )}

      {!hasStarted && (
        <p className="text-[9px] font-mono text-hud-fg/25 tracking-wide">
          NOT STARTED
        </p>
      )}
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

interface ProgressPanelProps {
  messages: UnifiedMessage[]
}

export default function ProgressPanel({ messages }: ProgressPanelProps) {
  const progress = computeAgentProgress(messages)
  const nextStep = computeNextStep(progress)

  return (
    <div className="w-72 shrink-0 h-full flex flex-col bg-hud-bg border-l border-hud-fg/20 overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-hud-fg/20 shrink-0">
        <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-hud-fg/50">
          MISSION STATUS
        </span>
      </div>

      {/* Agent cards — scrollable */}
      <div className="flex-1 overflow-y-auto">
        {progress.map((ap) => (
          <AgentCard key={ap.agentKey} progress={ap} />
        ))}
      </div>

      {/* Next step — sticky bottom */}
      <div className="shrink-0 bg-hud-fg px-3 py-2.5 border-t border-hud-fg/30">
        <p className="text-[8px] font-mono tracking-widest uppercase text-hud-fg/40 mb-0.5">
          ▶ NEXT STEP
        </p>
        {nextStep ? (
          <>
            <p className="text-[10px] font-mono font-bold text-hud-accent leading-snug">
              {nextStep.agentLabel.toUpperCase()}
            </p>
            <p className="text-[10px] font-mono text-hud-fg/60 leading-relaxed mt-0.5">
              {nextStep.action}
            </p>
          </>
        ) : (
          <p className="text-[10px] font-mono font-bold text-hud-accent tracking-wide">
            ALL MILESTONES COMPLETE
          </p>
        )}
      </div>
    </div>
  )
}
