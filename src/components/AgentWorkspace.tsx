'use client'

import { useState } from 'react'
import FileUploadPanel from '@/components/FileUploadPanel'
import UnifiedChatWindow, { type UnifiedMessage } from '@/components/UnifiedChatWindow'
import { useSession } from '@/contexts/SessionContext'

export type { UnifiedMessage }

interface AgentWorkspaceProps {
  projectId: string
  initialMessages: UnifiedMessage[]
}

export default function AgentWorkspace({ projectId, initialMessages }: AgentWorkspaceProps) {
  const [activeAgent, setActiveAgent] = useState('trend-mapper')
  const { sessionNumber } = useSession()

  return (
    <div className="flex flex-col h-full bg-hud-fg">
      <div className="flex-1 overflow-hidden">
        <UnifiedChatWindow
          projectId={projectId}
          initialMessages={initialMessages}
          activeAgent={activeAgent}
          onAgentChange={setActiveAgent}
          currentSession={sessionNumber}
        />
      </div>
      <FileUploadPanel projectId={projectId} />
    </div>
  )
}
