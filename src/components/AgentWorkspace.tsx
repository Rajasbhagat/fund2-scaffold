'use client'

import { useState } from 'react'
import AgentTabs from '@/components/AgentTabs'
import ChatWindow from '@/components/ChatWindow'
import { useSession } from '@/contexts/SessionContext'

interface Message {
  id: string
  role: string
  content: string
  isError?: boolean
}

interface AgentWorkspaceProps {
  projectId: string
  initialMessagesByAgent: Record<string, Message[]>
}

const AGENTS = ['trend-mapper', 'value-designer', 'spi', 'faro']

export default function AgentWorkspace({ projectId, initialMessagesByAgent }: AgentWorkspaceProps) {
  const [activeAgent, setActiveAgent] = useState('trend-mapper')
  const { sessionNumber: _sessionNumber } = useSession()

  return (
    <div className="flex flex-col h-full">
      <AgentTabs activeAgent={activeAgent} onTabChange={setActiveAgent} />
      <div className="flex-1 overflow-hidden relative">
        {AGENTS.map((agent) => (
          <div
            key={agent}
            className={`absolute inset-0 ${activeAgent === agent ? 'block h-full' : 'hidden'}`}
          >
            <ChatWindow
              projectId={projectId}
              initialMessages={initialMessagesByAgent[agent] ?? []}
              showDeepResearch={agent === 'trend-mapper'}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
