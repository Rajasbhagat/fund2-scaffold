import 'server-only'
import type { SlideType } from './thresholds'

export function filterMessagesForSlide(
  messages: Array<{ role: string; content: string; agentType?: string | null }>,
  agentType: string
): Array<{ role: string; content: string; agentType?: string | null }> {
  return messages.filter((m) => {
    if (m.role === 'user') return true
    if (m.role === 'assistant') {
      if (m.agentType === agentType) return true
      // Include legacy null agentType messages only for trend-mapper (v1.0 messages had no agentType)
      if (agentType === 'trend-mapper' && m.agentType == null) return true
    }
    return false
  })
}

export function getAgentTypeForSlide(slideType: SlideType): string {
  if (slideType === 'trend-mapper') return 'trend-mapper'
  return 'value-designer'
}
