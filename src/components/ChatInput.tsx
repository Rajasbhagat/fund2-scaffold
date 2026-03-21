'use client'

import { useState, KeyboardEvent } from 'react'

interface ChatInputProps {
  onSubmit: (message: string) => void
  disabled: boolean
}

export default function ChatInput({ onSubmit, disabled }: ChatInputProps) {
  const [text, setText] = useState('')

  function handleSubmit() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setText('')
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div className="flex gap-2 p-4 border-t border-gray-200">
      <textarea
        className="flex-1 resize-none rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a message..."
      />
      <button
        className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={handleSubmit}
        disabled={disabled}
      >
        {disabled ? 'Thinking...' : 'Send'}
      </button>
    </div>
  )
}
