'use client'

import { useState, useEffect, useRef } from 'react'
import ChatInput from '@/components/ChatInput'
import MessageBubble from '@/components/MessageBubble'
import AgentPicker from '@/components/AgentPicker'

export interface UnifiedMessage {
  id: string
  role: string
  content: string
  agentType?: string | null
  isError?: boolean
}

interface UnifiedChatWindowProps {
  projectId: string
  initialMessages: UnifiedMessage[]
  activeAgent: string
  onAgentChange: (agent: string) => void
  currentSession: number
  onMessagesChange?: (messages: UnifiedMessage[]) => void
}

const AGENT_DISPLAY_NAMES: Record<string, string> = {
  'trend-mapper': 'TREND MAPPER',
  'value-designer': 'VALUE DESIGNER',
  spi: 'SPI',
  faro: 'FARO',
}

function getEndpoint(agentId: string, projectId: string): string {
  switch (agentId) {
    case 'value-designer': return `/api/chat/value-designer/${projectId}`
    case 'spi': return `/api/chat/spi/${projectId}`
    case 'faro': return `/api/chat/faro/${projectId}`
    default: return `/api/chat/${projectId}`
  }
}

function ThinkingIndicator({ agentDisplayName }: { agentDisplayName: string }) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <span
        className="text-[10px] tracking-[0.2em] text-hud-accent/50 uppercase"
      >
        {agentDisplayName}
      </span>
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ border: '1px solid rgba(235,255,0,0.12)', background: 'rgba(235,255,0,0.03)' }}
      >
        <span className="w-1.5 h-1.5 bg-hud-accent/60 animate-bounce [animation-delay:0ms]" />
        <span className="w-1.5 h-1.5 bg-hud-accent/60 animate-bounce [animation-delay:150ms]" />
        <span className="w-1.5 h-1.5 bg-hud-accent/60 animate-bounce [animation-delay:300ms]" />
        <span
          className="text-[9px] text-hud-accent/30 mono tracking-[0.2em] ml-1"
        >
          PROCESSING
        </span>
      </div>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 pb-16 select-none">
      <div className="relative flex items-center justify-center w-14 h-14">
        <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-hud-accent/30" />
        <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-hud-accent/30" />
        <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-hud-accent/30" />
        <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-hud-accent/30" />
        <span className="text-hud-accent/20 text-xl">&#9672;</span>
      </div>
      <div className="text-center space-y-2">
        <div
          className="text-[11px] tracking-[0.3em] text-hud-bg/25 uppercase"
        >
          UNIFIED THREAD
        </div>
        <div className="text-xs text-hud-panel/20 max-w-[220px] leading-relaxed">
          Select an agent above and start a conversation
        </div>
      </div>
      <div
        className="text-[9px] tracking-[0.3em] text-hud-panel/15 uppercase"
      >
        AWAITING INPUT
      </div>
    </div>
  )
}

export default function UnifiedChatWindow({
  projectId,
  initialMessages,
  activeAgent,
  onAgentChange,
  currentSession,
  onMessagesChange,
}: UnifiedChatWindowProps) {
  const [messages, setMessages] = useState<UnifiedMessage[]>(initialMessages)

  // Notify parent whenever messages change
  useEffect(() => {
    onMessagesChange?.(messages)
  }, [messages, onMessagesChange])
  const [isLoading, setIsLoading] = useState(false)
  const [isStreaming, setIsStreaming] = useState(false)
  const [lastUserText, setLastUserText] = useState<string>('')
  const [deepResearch, setDeepResearch] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const agentDisplayName = AGENT_DISPLAY_NAMES[activeAgent] ?? 'AGENT'
  const showDeepResearch = activeAgent === 'trend-mapper' || activeAgent === 'faro'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading])

  async function sendMessage(userText: string) {
    const userMessage: UnifiedMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText,
    }

    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setLastUserText(userText)
    setIsLoading(true)
    setIsStreaming(true)

    try {
      const res = await fetch(getEndpoint(activeAgent, projectId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: updatedMessages.map((m) => ({ role: m.role, content: m.content, agentType: m.agentType })),
          currentSession,
          deepResearch,
        }),
      })

      if (!res.ok || !res.body) {
        let errorMsg = 'Something went wrong. Please try again.'
        try {
          const json = await res.json()
          if (json?.error) errorMsg = json.error
        } catch { /* ignore */ }
        setIsLoading(false)
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: 'assistant', content: errorMsg, isError: true, agentType: activeAgent },
        ])
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
          setMessages((prev) => [
            ...prev,
            { id: assistantId, role: 'assistant', content: chunk, agentType: activeAgent },
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
      setMessages((prev) => [
        ...prev,
        { id: crypto.randomUUID(), role: 'assistant', content: 'Something went wrong. Please try again.', isError: true, agentType: activeAgent },
      ])
    } finally {
      setIsLoading(false)
      setIsStreaming(false)
    }
  }

  function handleRetry() {
    if (!lastUserText) return
    setMessages((prev) => prev.slice(0, -1))
    void sendMessage(lastUserText)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Agent Picker */}
      <AgentPicker activeAgent={activeAgent} onAgentChange={onAgentChange} />

      {/* Message area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && !isLoading ? (
          <EmptyState />
        ) : (
          <div className="px-6 py-6 space-y-8 max-w-4xl mx-auto">
            {messages.map((msg) => {
              const isUser = msg.role === 'user'
              const label = isUser ? 'YOU' : (AGENT_DISPLAY_NAMES[msg.agentType ?? ''] ?? 'AGENT')
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}
                >
                  {/* Role label */}
                  <span
                    className={`text-[10px] tracking-[0.2em] uppercase ${isUser ? 'text-hud-bg/35' : 'text-hud-accent/55'}`}
                  >
                    {label}
                  </span>

                  {/* Bubble */}
                  {msg.isError ? (
                    <div
                      className="px-4 py-3 max-w-[80%]"
                      style={{ border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}
                    >
                      <p className="text-sm text-red-400/80 leading-relaxed">{msg.content}</p>
                      <button
                        onClick={handleRetry}
                        disabled={isStreaming}
                        className="mt-2 text-[10px] text-red-400/50 tracking-[0.2em] uppercase hover:text-red-400 disabled:opacity-40 transition-colors"
                      >
                        RETRY
                      </button>
                    </div>
                  ) : (
                    <MessageBubble role={isUser ? 'user' : 'model'} content={msg.content} />
                  )}
                </div>
              )
            })}

            {isLoading && <ThinkingIndicator agentDisplayName={agentDisplayName} />}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput
        onSubmit={(t) => void sendMessage(t)}
        disabled={isLoading || isStreaming}
        deepResearch={deepResearch}
        onDeepResearchToggle={() => setDeepResearch((prev) => !prev)}
        showDeepResearch={showDeepResearch}
      />
    </div>
  )
}
