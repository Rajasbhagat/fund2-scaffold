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

type TrendMapperData = {
  trendTitle: string | null
  ventureName: string | null
  industry: string | null
  trendBehavior: string | null
  targetUser: string | null
  dataPoint1: string | null
  dataPoint2: string | null
  dataPoint3: string | null
  drivers: string | null
  futureImpact: string | null
  opportunitiesRisks: string | null
  hmwGoal: string | null
  hmwTrend: string | null
}

type CondensedField = {
  field: string
  label: string
  original: string
  condensed: string
}

type Phase = 'idle' | 'extracting' | 'confirming' | 'generating'

/** Inline indicator: value text, condensed badge, or a red "missing" badge */
function FieldValue({
  value,
  original,
}: {
  value: string | null
  original?: string  // if set, this field was condensed from `original`
}) {
  if (value) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-[11px] font-mono text-hud-fg/90 leading-relaxed">{value}</span>
        {original && (
          <details className="cursor-pointer">
            <summary className="text-[9px] font-mono text-hud-accent/80 tracking-wide select-none list-none">
              ✂ condensed to fit — tap to see original
            </summary>
            <span className="text-[10px] font-mono text-hud-fg/40 line-through leading-relaxed block mt-0.5">
              {original}
            </span>
          </details>
        )}
      </div>
    )
  }
  return (
    <span className="text-[10px] font-mono text-red-400 tracking-wide">
      ✗ missing — continue the conversation
    </span>
  )
}

/** The 5-element confirmation panel for trend-mapper */
function TrendMapperConfirmation({
  data,
  missing,
  condensedFields,
  onConfirm,
  onCancel,
  isGenerating,
}: {
  data: TrendMapperData
  missing: string[]
  condensedFields: CondensedField[]
  onConfirm: () => void
  onCancel: () => void
  isGenerating: boolean
}) {
  const allPresent = missing.length === 0
  const condensedMap = Object.fromEntries(condensedFields.map((c) => [c.field, c.original]))

  const items: { label: string; content: React.ReactNode }[] = [
    {
      label: '1 — TREND OBSERVATION',
      content: (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2 items-start">
            <span className="text-[9px] font-mono text-hud-fg/40 tracking-widest uppercase w-16 shrink-0 pt-0.5">Industry</span>
            <FieldValue value={data.industry} original={condensedMap['industry']} />
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-[9px] font-mono text-hud-fg/40 tracking-widest uppercase w-16 shrink-0 pt-0.5">Behavior</span>
            <FieldValue value={data.trendBehavior} original={condensedMap['trendBehavior']} />
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-[9px] font-mono text-hud-fg/40 tracking-widest uppercase w-16 shrink-0 pt-0.5">Target</span>
            <FieldValue value={data.targetUser} original={condensedMap['targetUser']} />
          </div>
        </div>
      ),
    },
    {
      label: '2 — SUPPORTING EVIDENCE',
      content: (
        <div className="flex flex-col gap-1">
          {(['dataPoint1', 'dataPoint2', 'dataPoint3'] as const).map((key, i) => (
            <div key={key} className="flex gap-2 items-start">
              <span className="text-[9px] font-mono text-hud-fg/40 tracking-widest uppercase w-16 shrink-0 pt-0.5">Data {i + 1}</span>
              <FieldValue value={data[key]} original={condensedMap[key]} />
            </div>
          ))}
        </div>
      ),
    },
    {
      label: '3 — KEY DRIVERS',
      content: <FieldValue value={data.drivers} original={condensedMap['drivers']} />,
    },
    {
      label: '4 — FUTURE IMPACT',
      content: (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2 items-start">
            <span className="text-[9px] font-mono text-hud-fg/40 tracking-widest uppercase w-16 shrink-0 pt-0.5">Impact</span>
            <FieldValue value={data.futureImpact} original={condensedMap['futureImpact']} />
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-[9px] font-mono text-hud-fg/40 tracking-widest uppercase w-16 shrink-0 pt-0.5">Opps/Risks</span>
            <FieldValue value={data.opportunitiesRisks} original={condensedMap['opportunitiesRisks']} />
          </div>
        </div>
      ),
    },
    {
      label: '5 — HMW QUESTION',
      content: (
        <div className="flex flex-col gap-1">
          <div className="flex gap-2 items-start">
            <span className="text-[9px] font-mono text-hud-fg/40 tracking-widest uppercase w-16 shrink-0 pt-0.5">Goal</span>
            <FieldValue value={data.hmwGoal} original={condensedMap['hmwGoal']} />
          </div>
          <div className="flex gap-2 items-start">
            <span className="text-[9px] font-mono text-hud-fg/40 tracking-widest uppercase w-16 shrink-0 pt-0.5">Trend Ref</span>
            <FieldValue value={data.hmwTrend} original={condensedMap['hmwTrend']} />
          </div>
        </div>
      ),
    },
  ]

  return (
    <div className="border border-hud-fg/20 bg-hud-bg mt-2 p-3 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-hud-fg/50">
          SLIDE PREVIEW — CONFIRM 5 ELEMENTS
        </span>
        <button
          onClick={onCancel}
          className="text-[9px] font-mono text-hud-fg/40 hover:text-hud-fg/80 tracking-widest uppercase"
        >
          ✕ CANCEL
        </button>
      </div>

      {/* Condenser notice */}
      {condensedFields.length > 0 && (
        <div className="border border-hud-accent/40 bg-hud-accent/5 p-2">
          <p className="text-[10px] font-mono text-hud-fg/70 leading-relaxed">
            ✂ {condensedFields.length} field{condensedFields.length > 1 ? 's' : ''} were automatically condensed to fit the slide layout.
            Tap any "✂ condensed to fit" label below to see the original text.
          </p>
        </div>
      )}

      {/* Title + Venture */}
      <div className="border-b border-hud-fg/10 pb-2 flex flex-col gap-1">
        <div className="flex gap-2 items-start">
          <span className="text-[9px] font-mono text-hud-fg/40 tracking-widest uppercase w-20 shrink-0 pt-0.5">Trend Title</span>
          <FieldValue value={data.trendTitle} original={condensedMap['trendTitle']} />
        </div>
        <div className="flex gap-2 items-start">
          <span className="text-[9px] font-mono text-hud-fg/40 tracking-widest uppercase w-20 shrink-0 pt-0.5">Team/Venture</span>
          <FieldValue value={data.ventureName} original={condensedMap['ventureName']} />
        </div>
      </div>

      {/* 5 items */}
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1.5">
          <span className="text-[9px] font-mono font-bold tracking-widest uppercase text-hud-fg/60">
            {item.label}
          </span>
          <div className="pl-2">{item.content}</div>
        </div>
      ))}

      {/* Missing warning */}
      {!allPresent && (
        <div className="border border-red-400/30 bg-red-400/5 p-2">
          <p className="text-[10px] font-mono text-red-400 leading-relaxed">
            The following elements are incomplete. Continue the conversation then click "Check Again":
          </p>
          <ul className="mt-1 list-none">
            {missing.map((m) => (
              <li key={m} className="text-[10px] font-mono text-red-400">— {m}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Confirm button */}
      <button
        onClick={onConfirm}
        disabled={!allPresent || isGenerating}
        title={!allPresent ? 'Complete all 5 elements first' : undefined}
        className={`
          py-2 text-[10px] font-mono font-bold tracking-widest uppercase transition-colors
          ${isGenerating
            ? 'bg-hud-accent/60 text-hud-fg cursor-not-allowed'
            : allPresent
              ? 'bg-hud-accent text-hud-fg hover:bg-hud-accent/90'
              : 'bg-hud-panel/20 text-hud-fg/30 cursor-not-allowed'
          }
        `}
      >
        {isGenerating ? 'GENERATING...' : allPresent ? 'CONFIRM & GENERATE PRESENTATION' : 'COMPLETE ALL 5 ELEMENTS FIRST'}
      </button>
    </div>
  )
}

export default function SlideGenerateButton({
  slideType,
  messages,
  projectId,
  agentType,
  unlocked,
}: SlideGenerateButtonProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [extractedData, setExtractedData] = useState<TrendMapperData | null>(null)
  const [missingElements, setMissingElements] = useState<string[]>([])
  const [condensedFields, setCondensedFields] = useState<CondensedField[]>([])
  const [lastError, setLastError] = useState<string | null>(null)

  const threshold = SLIDE_THRESHOLDS[slideType] ?? 3
  const label = SLIDE_LABELS[slideType] ?? slideType.toUpperCase() + ' SLIDE'

  const matchingCount = messages.filter(
    (m) =>
      m.role === 'assistant' &&
      (m.agentType === agentType || (slideType === 'trend-mapper' && m.agentType == null)),
  ).length

  const thresholdMet = matchingCount >= threshold
  const isEnabled = unlocked === true || thresholdMet

  // ── Trend-mapper: two-stage flow ──
  async function handleTrendMapperClick() {
    if (!isEnabled || phase !== 'idle') return
    setPhase('extracting')
    setLastError(null)

    try {
      const res = await fetch(`/api/slides/trend-mapper/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'extract', messages }),
      })

      if (!res.ok) {
        const json = await res.json() as { error?: string; reason?: string }
        setLastError(json.reason ?? json.error ?? 'Analysis failed — please try again')
        setPhase('idle')
        return
      }

      const json = await res.json() as { data: TrendMapperData; missing: string[]; condensedFields: CondensedField[] }
      setExtractedData(json.data)
      setMissingElements(json.missing)
      setCondensedFields(json.condensedFields ?? [])
      setPhase('confirming')
    } catch {
      setLastError('Analysis failed — please try again')
      setPhase('idle')
    }
  }

  async function handleTrendMapperConfirm() {
    if (!extractedData || phase === 'generating') return
    setPhase('generating')
    setLastError(null)

    try {
      const res = await fetch(`/api/slides/trend-mapper/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'generate', data: extractedData }),
      })

      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = 'fund2-trend-mapper-slide.pptx'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        setPhase('idle')
        setExtractedData(null)
      } else {
        const json = await res.json() as { error?: string }
        setLastError(json.error ?? 'Generation failed — please try again')
        setPhase('confirming')
      }
    } catch {
      setLastError('Generation failed — please try again')
      setPhase('confirming')
    }
  }

  function handleCancel() {
    setPhase('idle')
    setExtractedData(null)
    setMissingElements([])
    setCondensedFields([])
    setLastError(null)
  }

  // ── Re-check: re-extract without resetting to idle ──
  async function handleRecheck() {
    setPhase('extracting')
    setLastError(null)

    try {
      const res = await fetch(`/api/slides/trend-mapper/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'extract', messages }),
      })

      if (!res.ok) {
        const json = await res.json() as { error?: string }
        setLastError(json.error ?? 'Analysis failed — please try again')
        setPhase('confirming')
        return
      }

      const json = await res.json() as { data: TrendMapperData; missing: string[]; condensedFields: CondensedField[] }
      setExtractedData(json.data)
      setMissingElements(json.missing)
      setCondensedFields(json.condensedFields ?? [])
      setPhase('confirming')
    } catch {
      setLastError('Analysis failed — please try again')
      setPhase('confirming')
    }
  }

  // ── Other slide types: original single-step flow ──
  async function handleOtherGenerate() {
    if (!isEnabled || phase !== 'idle') return
    setPhase('generating')
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
        const json = await res.json() as { reason: string }
        setLastError(json.reason)
      } else {
        setLastError('Generation failed — please try again')
      }
    } catch {
      setLastError('Generation failed — please try again')
    } finally {
      setPhase('idle')
    }
  }

  // ── Trend-mapper render ──
  if (slideType === 'trend-mapper') {
    return (
      <div className="flex flex-col gap-1.5">
        {phase !== 'confirming' && (
          <button
            onClick={() => void handleTrendMapperClick()}
            disabled={!isEnabled || phase !== 'idle'}
            title={!isEnabled ? 'Continue the conversation to unlock' : undefined}
            className={`
              px-5 py-2 text-[10px] font-mono font-bold tracking-widest uppercase transition-colors
              ${phase === 'extracting'
                ? 'bg-hud-accent/60 text-hud-fg cursor-not-allowed'
                : isEnabled
                  ? 'bg-hud-accent text-hud-fg hover:bg-hud-accent/90'
                  : 'bg-hud-panel/20 text-hud-fg/30 cursor-not-allowed'
              }
            `}
          >
            {phase === 'extracting' ? 'ANALYSING...' : label}
          </button>
        )}

        {phase === 'confirming' && extractedData && (
          <>
            <TrendMapperConfirmation
              data={extractedData}
              missing={missingElements}
              condensedFields={condensedFields}
              onConfirm={() => void handleTrendMapperConfirm()}
              onCancel={handleCancel}
              isGenerating={false}
            />
            {missingElements.length > 0 && (
              <button
                onClick={() => void handleRecheck()}
                className="py-1.5 text-[9px] font-mono tracking-widest uppercase text-hud-fg/60 hover:text-hud-fg border border-hud-fg/20 hover:border-hud-fg/50 transition-colors"
              >
                CHECK AGAIN
              </button>
            )}
          </>
        )}

        {phase === 'generating' && extractedData && (
          <TrendMapperConfirmation
            data={extractedData}
            missing={[]}
            condensedFields={condensedFields}
            onConfirm={() => {}}
            onCancel={() => {}}
            isGenerating={true}
          />
        )}

        {lastError && (
          <span className="text-[10px] text-red-400 tracking-wide font-mono">{lastError}</span>
        )}
      </div>
    )
  }

  // ── Other slide types: original single-step render ──
  return (
    <div className="flex flex-col gap-1.5">
      <button
        onClick={() => void handleOtherGenerate()}
        disabled={!isEnabled || phase !== 'idle'}
        title={!isEnabled ? 'Continue the conversation to unlock' : undefined}
        className={`
          px-5 py-2 text-[10px] font-mono font-bold tracking-widest uppercase transition-colors
          ${phase === 'generating'
            ? 'bg-hud-accent/60 text-hud-fg cursor-not-allowed'
            : isEnabled
              ? 'bg-hud-accent text-hud-fg hover:bg-hud-accent/90'
              : 'bg-hud-panel/20 text-hud-fg/30 cursor-not-allowed'
          }
        `}
      >
        {phase === 'generating' ? 'GENERATING...' : label}
      </button>
      {lastError && (
        <span className="text-[10px] text-red-400 tracking-wide font-mono">{lastError}</span>
      )}
    </div>
  )
}
