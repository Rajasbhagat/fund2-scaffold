'use client'

const AGENTS = [
  { id: 'trend-mapper', label: 'TREND MAPPER' },
  { id: 'value-designer', label: 'VALUE DESIGNER' },
  { id: 'spi', label: 'SPI' },
  { id: 'faro', label: 'FARO' },
]

interface AgentPickerProps {
  activeAgent: string
  onAgentChange: (agent: string) => void
}

export default function AgentPicker({ activeAgent, onAgentChange }: AgentPickerProps) {
  return (
    <div className="flex gap-2 px-4 pt-2 pb-1">
      {AGENTS.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onAgentChange(agent.id)}
          className={`px-3 py-1 text-[10px] font-medium tracking-[0.2em] uppercase transition-colors ${
            activeAgent === agent.id
              ? 'bg-[#ebff00] text-[#1a2024]'
              : 'border border-[#b1dbd8]/20 text-[#b1dbd8]/40 hover:text-[#b1dbd8]'
          }`}
          style={{ fontFamily: "'Rajdhani', sans-serif" }}
        >
          {agent.label}
        </button>
      ))}
    </div>
  )
}
