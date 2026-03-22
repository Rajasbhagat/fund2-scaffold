'use client'

const AGENTS = [
  { id: 'trend-mapper', label: 'TREND MAPPER' },
  { id: 'value-designer', label: 'VALUE DESIGNER' },
  { id: 'spi', label: 'SPI' },
  { id: 'faro', label: 'FARO' },
]

interface AgentTabsProps {
  activeAgent: string
  onTabChange: (agent: string) => void
}

export default function AgentTabs({ activeAgent, onTabChange }: AgentTabsProps) {
  return (
    <div className="flex border-b border-hud-panel/15 bg-hud-fg shrink-0">
      {AGENTS.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onTabChange(agent.id)}
          className={`
            px-4 py-2.5 text-[10px] font-sans font-medium tracking-[0.2em] border-b-2 -mb-px transition-colors
            ${
              activeAgent === agent.id
                ? 'border-hud-accent text-hud-accent'
                : 'border-transparent text-hud-panel/40 hover:text-hud-panel'
            }
          `}
        >
          {activeAgent === agent.id ? `[ ${agent.label} ]` : agent.label}
        </button>
      ))}
    </div>
  )
}
