import 'server-only'
import { type SlideType } from './thresholds'

export interface SlideMessage {
  role: string
  content: string
  agentType?: string | null
}

export function filterMessagesForSlide(messages: SlideMessage[], slideType: SlideType): SlideMessage[] {
  const agentType = getAgentTypeForSlide(slideType)
  return messages.filter((m) => {
    if (m.role === 'user') return true
    if (m.role === 'assistant') {
      if (m.agentType === agentType) return true
      // Include legacy null agentType messages only for trend-mapper (v1.0 messages had no agentType)
      if (slideType === 'trend-mapper' && m.agentType == null) return true
    }
    return false
  })
}

export function getAgentTypeForSlide(slideType: SlideType): string {
  if (slideType === 'trend-mapper') return 'trend-mapper'
  return 'value-designer'
}
