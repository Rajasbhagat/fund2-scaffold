'use client'

import { useState } from 'react'
import type { UnifiedMessage } from '@/components/UnifiedChatWindow'
import { SLIDE_THRESHOLDS, SLIDE_LABELS } from '@/lib/slides/thresholds-client'

interface SlideGenerateButtonProps {
  slideType: string
  messages: UnifiedMessage[]
  projectId: string
  agentType: string
  unlocked?: boolean
}

export default function SlideGenerateButton({
  slideType,
  messages,
  projectId,
  agentType,
  unlocked,
}: SlideGenerateButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const threshold = SLIDE_THRESHOLDS[slideType] ?? 3
  const label = SLIDE_LABELS[slideType] ?? slideType.toUpperCase() + ' SLIDE'

  // Count assistant messages where agentType matches (trend-mapper uses null/undefined agentType too)
  const matchingCount = messages.filter(
    (m) =>
      m.role === 'assistant' &&
      (m.agentType === agentType || (slideType === 'trend-mapper' && m.agentType == null)),
  ).length

  const thresholdMet = matchingCount >= threshold
  const isEnabled = unlocked === true || thresholdMet

  async function handleGenerate() {
    if (!isEnabled || isGenerating) return
    setIsGenerating(true)
    setLastError(null)

    try {
      const res = await fetch(`/api/slides/${slideType}/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `fund2-${slideType}-slide.pptx`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } else if (res.status === 422) {
        const json = await res.json() as { ready: boolean; reason: string }
        setLastError(json.reason)
      } else {
        setLastError('Generation failed — please try again')
      }
    } catch {
      setLastError('Generation failed — please try again')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={() => void handleGenerate()}
        disabled={!isEnabled || isGenerating}
        title={!isEnabled ? 'Continue the conversation to unlock' : undefined}
        className={`
          px-5 py-2 text-[10px] font-mono font-bold tracking-widest uppercase transition-colors
          ${
            isGenerating
              ? 'bg-hud-accent/60 text-hud-fg cursor-not-allowed'
              : isEnabled
                ? 'bg-hud-accent text-hud-fg hover:bg-hud-accent/90'
                : 'bg-hud-panel/20 text-hud-fg/30 cursor-not-allowed'
          }
        `}
      >
        {isGenerating ? 'GENERATING...' : label}
      </button>
      {lastError && (
        <span className="text-[10px] text-red-400 tracking-wide font-mono">
          {lastError}
        </span>
      )}
    </div>
  )
}
