'use client'

import { useState } from 'react'
import FileUploadPanel from '@/components/FileUploadPanel'
import { useSession } from '@/contexts/SessionContext'

export interface UnifiedMessage {
  id: string
  role: string
  content: string
  agentType?: string | null
  isError?: boolean
}

interface AgentWorkspaceProps {
  projectId: string
  initialMessages: UnifiedMessage[]
}

export default function AgentWorkspace({ projectId, initialMessages }: AgentWorkspaceProps) {
  const [activeAgent, setActiveAgent] = useState('trend-mapper')
  const { sessionNumber } = useSession()

  return (
    <div className="flex flex-col h-full bg-[#1a2024]">
      <div className="flex-1 overflow-hidden">
        {/* UnifiedChatWindow will be rendered here in US-005 */}
        <div
          className="flex items-center justify-center h-full text-[#b1dbd8]/40 text-sm"
          style={{ fontFamily: "'Rajdhani', sans-serif" }}
        >
          Loading unified chat...
        </div>
      </div>
      <FileUploadPanel projectId={projectId} />
    </div>
  )
}
