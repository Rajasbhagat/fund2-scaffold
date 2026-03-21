'use client'

import { useState, useEffect, useRef } from 'react'
import ChatInput from '@/components/ChatInput'
import MessageBubble from '@/components/MessageBubble'

interface Message {
  id: string
  role: string
  content: string
  isError?: boolean
}

interface ChatWindowProps {
  projectId: string
  initialMessages: Message[]
  showDeepResearch?: boolean
}

function roleLabel(role: string): string {
  return role === 'user' ? 'You' : 'Trend Mapper'
}

function ThinkingIndicator() {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Trend Mapper
      </span>
      <div className="flex items-center gap-1 py-1">
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
      </div>
    </div>
  )
}

export default function ChatWindow({ projectId, initialMessages, showDeepResearch: _showDeepResearch }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [lastUserText, setLastUserText] = useState<string>('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function sendMessage(userText: string) {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
    }

    setMessages((prev) => [...prev, userMessage])
    setLastUserText(userText)
    setIsLoading(true)
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
        setIsLoading(false)
        const errorMessage: Message = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: errorMsg,
          isError: true,
        }
        setMessages((prev) => [...prev, errorMessage])
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let firstToken = true
      const assistantId = crypto.randomUUID()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value, { stream: true })

        if (firstToken) {
          firstToken = false
          setIsLoading(false)
          // Add the assistant message with the first chunk
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: chunk },
          ])
        } else {
          setMessages((prev) => {
            const updated = [...prev]
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk,
            }
            return updated
          })
        }
      }
    } catch {
      setIsLoading(false)
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Something went wrong. Please try again.',
        isError: true,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
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
              <MessageBubble role={msg.role === 'assistant' ? 'model' : 'user'} content={msg.content} />
            )}
          </div>
        ))}
        {isLoading && <ThinkingIndicator />}
        <div ref={bottomRef} />
      </div>
      <ChatInput onSubmit={handleSubmit} disabled={isLoading || isStreaming} />
    </div>
  )
}
