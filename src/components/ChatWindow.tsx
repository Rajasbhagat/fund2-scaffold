'use client'

import { useState, useEffect, useRef } from 'react'
import ChatInput from '@/components/ChatInput'

interface Message {
  id: string
  role: string
  content: string
  isError?: boolean
}

interface ChatWindowProps {
  projectId: string
  initialMessages: Message[]
}

function roleLabel(role: string): string {
  return role === 'user' ? 'You' : 'Trend Mapper'
}

export default function ChatWindow({ projectId, initialMessages }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const [lastUserText, setLastUserText] = useState<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage(userText: string) {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
    }

    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
    }

    setMessages((prev) => [...prev, userMessage, assistantMessage])
    setLastUserText(userText)
    setIsStreaming(true)

    try {
      const res = await fetch(`/api/chat/${projectId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: userText }] }),
      })

      if (!res.ok || !res.body) {
        let errorMsg = 'Something went wrong. Please try again.'
        try {
          const json = await res.json()
          if (json?.error) errorMsg = json.error
        } catch {
          // ignore JSON parse failure
        }
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...assistantMessage,
            content: errorMsg,
            isError: true,
          }
          return updated
        })
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: 'Something went wrong. Please try again.',
          isError: true,
        }
        return updated
      })
    } finally {
      setIsStreaming(false)
    }
  }

  function handleSubmit(userText: string) {
    void sendMessage(userText)
  }

  function handleRetry() {
    if (!lastUserText) return
    // Remove the last error message before retrying
    setMessages((prev) => prev.slice(0, -1))
    void sendMessage(lastUserText)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              {roleLabel(msg.role)}
            </span>
            {msg.isError ? (
              <div className="border border-red-300 rounded p-3 bg-red-50">
                <p className="text-sm text-red-700 whitespace-pre-wrap">{msg.content}</p>
                <button
                  onClick={handleRetry}
                  disabled={isStreaming}
                  className="mt-2 text-xs text-red-600 underline hover:text-red-800 disabled:opacity-50"
                >
                  Retry
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{msg.content}</p>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSubmit={handleSubmit} disabled={isStreaming} />
    </div>
  )
}
