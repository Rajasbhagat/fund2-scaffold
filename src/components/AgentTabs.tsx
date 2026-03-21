'use client'

const AGENTS = [
  { id: 'trend-mapper', label: 'Trend Mapper' },
  { id: 'value-designer', label: 'Value Designer' },
  { id: 'spi', label: 'SPI' },
  { id: 'faro', label: 'FARO' },
]

interface AgentTabsProps {
  activeAgent: string
  onTabChange: (agent: string) => void
}

export default function AgentTabs({ activeAgent, onTabChange }: AgentTabsProps) {
  return (
    <div className="flex border-b border-gray-200">
      {AGENTS.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onTabChange(agent.id)}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
            activeAgent === agent.id
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-gray-500'
          }`}
        >
          {agent.label}
        </button>
      ))}
    </div>
  )
}
