'use client'

import { useState, useEffect } from 'react'
import type { UnifiedMessage } from '@/components/UnifiedChatWindow'
import SlideGenerateButton from '@/components/SlideGenerateButton'
import { SLIDE_THRESHOLDS } from '@/lib/slides/thresholds-client'
import { HUDLabel } from '@/components/hud'

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

  const relevantSlides = AGENT_SLIDES[activeAgent]
  if (!relevantSlides || relevantSlides.length === 0) return null

  return (
    <div className="border-t border-hud-panel/20 px-4 py-3 bg-hud-fg">
      <HUDLabel className="mb-2 text-hud-accent/60">SLIDE EXPORT</HUDLabel>
      <div className="flex flex-wrap gap-2">
        {relevantSlides.map((slideType) => (
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
  )
}
