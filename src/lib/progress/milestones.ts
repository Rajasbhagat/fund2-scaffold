import type { UnifiedMessage } from '@/components/UnifiedChatWindow'

// ── Milestone definitions ─────────────────────────────────────────────────────

interface MilestoneDef {
  id: string
  label: string
  /** Minimum assistant/model messages needed for this milestone to be complete */
  minAssistantMessages: number
}

interface AgentDef {
  label: string
  milestones: MilestoneDef[]
}

export const AGENT_MILESTONES: Record<string, AgentDef> = {
  'trend-mapper': {
    label: 'Trend Mapper',
    milestones: [
      { id: 'tm-1', label: 'Trend topic chosen',          minAssistantMessages: 2  },
      { id: 'tm-2', label: 'Evidence documented',         minAssistantMessages: 5  },
      { id: 'tm-3', label: 'Drivers & implications mapped', minAssistantMessages: 9  },
      { id: 'tm-4', label: 'Opportunity & HMW framed',    minAssistantMessages: 13 },
      { id: 'tm-5', label: 'Slide export unlocked',       minAssistantMessages: 4  },
    ],
  },
  'value-designer': {
    label: 'Value Designer',
    milestones: [
      { id: 'vd-1', label: 'User persona defined',          minAssistantMessages: 4  },
      { id: 'vd-2', label: 'Problem deep-dive complete',    minAssistantMessages: 8  },
      { id: 'vd-3', label: 'Job-to-be-Done crafted',        minAssistantMessages: 12 },
      { id: 'vd-4', label: 'Key tasks & outcomes mapped',   minAssistantMessages: 17 },
      { id: 'vd-5', label: 'Digital density canvas filled', minAssistantMessages: 22 },
      { id: 'vd-6', label: 'Solution consolidated',         minAssistantMessages: 27 },
    ],
  },
  'spi': {
    label: 'SPI — Persona Interviewer',
    milestones: [
      { id: 'spi-1', label: 'Persona generated',    minAssistantMessages: 2  },
      { id: 'spi-2', label: 'Interview in progress', minAssistantMessages: 4  },
      { id: 'spi-3', label: 'Interview completed',   minAssistantMessages: 9  },
      { id: 'spi-4', label: 'Assumptions validated', minAssistantMessages: 13 },
    ],
  },
}

// ── Computed types ────────────────────────────────────────────────────────────

export interface MilestoneStatus {
  id: string
  label: string
  completed: boolean
}

export interface AgentProgress {
  agentKey: string
  label: string
  assistantMessages: number
  milestones: MilestoneStatus[]
  recentTopics: string[]
}

export interface NextStep {
  agentKey: string
  agentLabel: string
  action: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if a message belongs to the given agent key.
 *  Trend Mapper uses agentType === null | undefined (no agentType set). */
function matchesAgent(msg: UnifiedMessage, agentKey: string): boolean {
  if (agentKey === 'trend-mapper') {
    return msg.agentType == null
  }
  return msg.agentType === agentKey
}

function isAssistant(msg: UnifiedMessage): boolean {
  return msg.role === 'assistant' || msg.role === 'model'
}

function isUser(msg: UnifiedMessage): boolean {
  return msg.role === 'user'
}

// ── Core exports ──────────────────────────────────────────────────────────────

export function computeAgentProgress(messages: UnifiedMessage[]): AgentProgress[] {
  return Object.entries(AGENT_MILESTONES).map(([agentKey, def]) => {
    const agentMsgs = messages.filter((m) => matchesAgent(m, agentKey))
    const assistantCount = agentMsgs.filter(isAssistant).length

    const milestones: MilestoneStatus[] = def.milestones.map((m) => ({
      id: m.id,
      label: m.label,
      completed: assistantCount >= m.minAssistantMessages,
    }))

    const recentTopics = agentMsgs
      .filter(isUser)
      .slice(-3)
      .map((m) => m.content.trim().slice(0, 60))

    return { agentKey, label: def.label, assistantMessages: assistantCount, milestones, recentTopics }
  })
}

const NEXT_STEP_ACTIONS: Record<string, string[]> = {
  'trend-mapper': [
    'Start chatting to identify your trend',
    'Gather real-world evidence for your trend',
    'Explore the drivers and future implications',
    'Frame your opportunity with a HMW question',
    'Generate your Trend Mapper slide',
  ],
  'value-designer': [
    'Define a detailed user persona',
    'Deep-dive into the core problem',
    'Craft a precise Job-to-be-Done statement',
    'Map key tasks and desired outcomes',
    'Fill in the Digital Density Canvas',
    'Consolidate your solution concept',
  ],
  'spi': [
    'Start an interview — provide your venture concept',
    'Continue the interview with probing questions',
    'Wrap up and trigger the interview debrief',
    'Review assumptions and plan your next experiment',
  ],
}

/** Returns the next recommended action following the FUND II course arc:
 *  Trend Mapper → Value Designer → SPI */
export function computeNextStep(progress: AgentProgress[]): NextStep | null {
  const order = ['trend-mapper', 'value-designer', 'spi']

  for (const agentKey of order) {
    const ap = progress.find((p) => p.agentKey === agentKey)
    if (!ap) continue

    const completedCount = ap.milestones.filter((m) => m.completed).length
    const totalCount = ap.milestones.length

    if (completedCount < totalCount) {
      const actions = NEXT_STEP_ACTIONS[agentKey] ?? []
      const action = actions[completedCount] ?? `Continue with ${ap.label}`
      return { agentKey, agentLabel: ap.label, action }
    }
  }

  return null // all complete
}
