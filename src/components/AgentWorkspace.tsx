'use client'

import { useState, useCallback } from 'react'
import FileUploadPanel from '@/components/FileUploadPanel'
import UnifiedChatWindow, { type UnifiedMessage } from '@/components/UnifiedChatWindow'
import SlidePanel from '@/components/SlidePanel'
import ProgressPanel from '@/components/ProgressPanel'
import { useSession } from '@/contexts/SessionContext'

export type { UnifiedMessage }

interface AgentWorkspaceProps {
  projectId: string
  initialMessages: UnifiedMessage[]
}

export default function AgentWorkspace({ projectId, initialMessages }: AgentWorkspaceProps) {
  const [activeAgent, setActiveAgent] = useState('trend-mapper')
  const [messages, setMessages] = useState<UnifiedMessage[]>(initialMessages)
  const { sessionNumber } = useSession()

  const handleMessagesChange = useCallback((updated: UnifiedMessage[]) => {
    setMessages(updated)
  }, [])

  return (
    <div className="flex h-full bg-hud-fg">
      {/* ── Left: chat + slide + upload ── */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-hidden">
          <UnifiedChatWindow
            projectId={projectId}
            initialMessages={initialMessages}
            activeAgent={activeAgent}
            onAgentChange={setActiveAgent}
            currentSession={sessionNumber}
            onMessagesChange={handleMessagesChange}
          />
        </div>
        <SlidePanel
          messages={messages}
          activeAgent={activeAgent}
          projectId={projectId}
        />
        <FileUploadPanel projectId={projectId} />
      </div>

      {/* ── Right: mission status panel (lg+ only) ── */}
      <div className="hidden lg:flex lg:h-full">
        <ProgressPanel messages={messages} />
      </div>
    </div>
  )
}
