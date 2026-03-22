'use client'

import { useEffect, useRef, useState } from 'react'
import { HUDLabel } from '@/components/hud'

type ModalState = 'loading' | 'done' | 'error'

export default function LandingPromptModal({
  projectId,
  onClose,
}: {
  projectId: string
  onClose: () => void
}) {
  const [state, setState] = useState<ModalState>('loading')
  const [promptText, setPromptText] = useState('')
  const [copyLabel, setCopyLabel] = useState('COPY TO CLIPBOARD')
  const [errorMsg, setErrorMsg] = useState('')
  const [abortController, setAbortController] = useState<AbortController | null>(null)

  const generateRef = useRef<(() => void) | undefined>(undefined)

  const generate = () => {
    const controller = new AbortController()
    setAbortController(controller)

    fetch(`/api/landing-prompt/${projectId}`, {
      method: 'POST',
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          setErrorMsg(body.error ?? 'Something went wrong.')
          setState('error')
          return
        }
        const body = await res.json()
        setPromptText(body.prompt as string)
        setState('done')
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') {
          onClose()
          return
        }
        setErrorMsg(err instanceof Error ? err.message : 'Unknown error')
        setState('error')
      })
      .finally(() => {
        setAbortController(null)
      })
  }

  generateRef.current = generate

  useEffect(() => {
    generateRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCancel = () => {
    abortController?.abort()
    onClose()
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(promptText)
    setCopyLabel('COPIED!')
    setTimeout(() => setCopyLabel('COPY PROMPT'), 2000)
  }

  const handleDownload = () => {
    const blob = new Blob([promptText], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'landing-page-prompt.md'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleRetry = () => {
    setState('loading')
    setErrorMsg('')
    generate()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-hud-fg border border-hud-panel/30 w-full max-w-3xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-hud-panel/20">
          <HUDLabel>LANDING PAGE PROMPT</HUDLabel>
          {state === 'loading' ? (
            <button
              onClick={handleCancel}
              className="text-[10px] tracking-[0.2em] text-hud-panel/60 hover:text-hud-accent uppercase font-sans"
            >
              CANCEL
            </button>
          ) : (
            <button
              onClick={onClose}
              className="text-[10px] tracking-[0.2em] text-hud-panel/60 hover:text-hud-accent uppercase font-sans"
            >
              CLOSE
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {state === 'loading' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <div className="w-6 h-6 border-2 border-hud-accent border-t-transparent rounded-full animate-spin" />
              <HUDLabel>SYNTHESIZING PROMPT FROM ALL CONVERSATIONS...</HUDLabel>
            </div>
          )}

          {state === 'done' && (
            <>
              {/* Action bar */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-hud-panel/20">
                <button
                  onClick={handleCopy}
                  className="text-[10px] tracking-[0.2em] uppercase font-sans bg-hud-accent text-hud-fg px-3 py-1.5 hover:opacity-80"
                >
                  {copyLabel}
                </button>
                <button
                  onClick={handleDownload}
                  className="text-[10px] tracking-[0.2em] uppercase font-sans border border-hud-panel/30 text-hud-panel/60 px-3 py-1.5 hover:text-hud-accent hover:border-hud-accent"
                >
                  DOWNLOAD .MD
                </button>
              </div>
              {/* Prompt content */}
              <div className="flex-1 overflow-y-auto p-4">
                <pre className="text-xs text-hud-panel/80 font-sans whitespace-pre-wrap leading-relaxed">
                  {promptText}
                </pre>
              </div>
            </>
          )}

          {state === 'error' && (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
              <HUDLabel className="text-red-400">{errorMsg}</HUDLabel>
              <button
                onClick={handleRetry}
                className="text-[10px] tracking-[0.2em] uppercase font-sans bg-hud-accent text-hud-fg px-3 py-1.5 hover:opacity-80"
              >
                RETRY
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
