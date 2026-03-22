'use client'

import { useState, useRef, KeyboardEvent } from 'react'

interface ChatInputProps {
  onSubmit: (message: string) => void
  disabled: boolean
  deepResearch: boolean
  onDeepResearchToggle: () => void
  showDeepResearch: boolean
}

export default function ChatInput({
  onSubmit,
  disabled,
  deepResearch,
  onDeepResearchToggle,
  showDeepResearch,
}: ChatInputProps) {
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function autoResize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value)
    autoResize()
  }

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setText('')
    // Reset height after clear
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="border-t border-hud-panel/15 bg-hud-fg shrink-0">
      <div className="flex gap-2 px-4 pt-3 pb-2">
        <textarea
          ref={textareaRef}
          className="
            flex-1 resize-none bg-transparent border border-hud-panel/20 px-3 py-2.5
            text-sm text-hud-bg placeholder:text-hud-panel/25
            focus:outline-none focus:border-hud-accent/40
            disabled:opacity-40 disabled:cursor-not-allowed
            transition-colors leading-relaxed
          "
          style={{ minHeight: '44px', maxHeight: '160px' }}
          rows={1}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder="ENTER QUERY..."
        />
        <div className="flex flex-col gap-1.5 justify-end">
          {showDeepResearch && (
            <button
              onClick={onDeepResearchToggle}
              disabled={disabled}
              className={`
                px-3 py-1.5 text-[10px] font-medium tracking-[0.15em] uppercase transition-colors
                disabled:opacity-30 disabled:cursor-not-allowed
                ${
                  deepResearch
                    ? 'bg-hud-accent text-hud-fg'
                    : 'border border-hud-panel/20 text-hud-panel/40 hover:text-hud-panel hover:border-hud-panel/40'
                }
              `}
              title="Enable deep web research"
            >
              DEEP
            </button>
          )}
          <button
            className="
              px-5 py-1.5 bg-hud-accent text-hud-fg text-[10px] font-bold tracking-[0.2em] uppercase
              hover:bg-hud-accent/90 disabled:opacity-30 disabled:cursor-not-allowed
              transition-colors
            "
            onClick={handleSubmit}
            disabled={disabled}
          >
            {disabled ? '···' : 'SEND'}
          </button>
        </div>
      </div>
      <div className="px-4 pb-2 flex items-center justify-end">
        <span
          className="text-[9px] text-hud-panel/25 tracking-wider"
        >
          ENTER TO SEND · SHIFT+ENTER FOR NEW LINE
        </span>
      </div>
    </div>
  )
}
