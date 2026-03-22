'use client'

import { useState, useEffect } from 'react'
import type { UnifiedMessage } from '@/components/UnifiedChatWindow'
import SlideGenerateButton from '@/components/SlideGenerateButton'
import { SLIDE_THRESHOLDS } from '@/lib/slides/thresholds-client'
import { HUDLabel } from '@/components/hud'
import { computeAgentProgress } from '@/lib/progress/milestones'
import LandingPromptModal from '@/components/LandingPromptModal'

// Slides available per agent
const AGENT_SLIDES: Record<string, string[]> = {
  'trend-mapper': ['trend-mapper'],
  'value-designer': ['opportunity', 'value-prop', 'customer-segment', 'business-model'],
}

interface SlidePanelProps {
  messages: UnifiedMessage[]
  activeAgent: string
  projectId: string
}

export default function SlidePanel({ messages, activeAgent, projectId }: SlidePanelProps) {
  const [unlockedSlides, setUnlockedSlides] = useState<Set<string>>(new Set())
  const [collapsed, setCollapsed] = useState(false)
  const [showLandingModal, setShowLandingModal] = useState(false)

  // One-way latch: add to Set when threshold met, never remove
  useEffect(() => {
    const relevantSlides = AGENT_SLIDES[activeAgent] ?? []
    const agentType = activeAgent  // 'trend-mapper' or 'value-designer'

    relevantSlides.forEach((slideType) => {
      const threshold = SLIDE_THRESHOLDS[slideType] ?? 3
      const count = messages.filter(
        (m) =>
          m.role === 'assistant' &&
          (m.agentType === agentType || (agentType === 'trend-mapper' && m.agentType == null))
      ).length
      if (count >= threshold) {
        setUnlockedSlides((prev) => {
          if (prev.has(slideType)) return prev
          const next = new Set(prev)
          next.add(slideType)
          return next
        })
      }
    })
  }, [messages, activeAgent])

  // Milestone gate for landing page button
  const allProgress = computeAgentProgress(messages)
  const tmProgress = allProgress.find((p) => p.agentKey === 'trend-mapper')
  const vdProgress = allProgress.find((p) => p.agentKey === 'value-designer')

  const tmAllComplete =
    (tmProgress?.milestones.length ?? 0) > 0 &&
    (tmProgress?.milestones.every((m) => m.completed) ?? false)

  const vdAllComplete =
    (vdProgress?.milestones.length ?? 0) > 0 &&
    (vdProgress?.milestones.every((m) => m.completed) ?? false)

  const landingReady = tmAllComplete && vdAllComplete

  const relevantSlides = AGENT_SLIDES[activeAgent]
  const hasSlides = !!(relevantSlides && relevantSlides.length > 0)

  if (!hasSlides && !landingReady) return null

  return (
    <>
      <div className="border-t-2 border-hud-panel/30 bg-hud-fg flex flex-col max-h-[45vh]">
        {/* SLIDE EXPORT header — only when active agent has slides */}
        {hasSlides && (
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="px-4 pt-3 pb-1.5 shrink-0 flex items-center justify-between w-full text-left hover:bg-hud-panel/5 transition-colors"
          >
            <HUDLabel className="text-hud-accent">SLIDE EXPORT</HUDLabel>
            <span className="text-[10px] font-mono text-hud-panel/50 tracking-widest select-none">
              {collapsed ? '▸' : '▾'}
            </span>
          </button>
        )}

        {/* Slide buttons — only when active agent has slides and not collapsed */}
        {hasSlides && !collapsed && (
          <div className="overflow-y-auto px-4 pb-3">
            <div className="flex flex-col gap-2">
              {relevantSlides!.map((slideType) => (
                <SlideGenerateButton
                  key={slideType}
                  slideType={slideType}
                  messages={messages}
                  projectId={projectId}
                  agentType={activeAgent}
                  unlocked={unlockedSlides.has(slideType)}
                />
              ))}
            </div>
          </div>
        )}

        {/* CREATE LANDING PAGE button — always rendered when panel is visible */}
        {!collapsed && (
          <div className="px-4 pb-3 pt-2 flex flex-col gap-1">
            <button
              disabled={!landingReady}
              onClick={() => landingReady && setShowLandingModal(true)}
              className={`w-full text-[10px] tracking-[0.2em] uppercase font-sans px-3 py-2 transition-colors ${
                landingReady
                  ? 'bg-hud-accent text-hud-fg hover:opacity-80 cursor-pointer'
                  : 'bg-hud-panel/10 text-hud-panel/30 cursor-not-allowed'
              }`}
            >
              CREATE LANDING PAGE
            </button>
            {!landingReady && (
              <span className="text-[9px] tracking-[0.15em] text-hud-panel/30 uppercase font-sans text-center">
                COMPLETE TM + VD MILESTONES TO UNLOCK
              </span>
            )}
          </div>
        )}
      </div>

      {showLandingModal && (
        <LandingPromptModal
          projectId={projectId}
          onClose={() => setShowLandingModal(false)}
        />
      )}
    </>
  )
}
