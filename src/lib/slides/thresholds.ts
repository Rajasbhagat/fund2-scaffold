import 'server-only'

export type SlideType = 'trend-mapper' | 'opportunity' | 'value-prop' | 'customer-segment' | 'business-model'

export const SLIDE_THRESHOLDS: Record<SlideType, number> = {
  'trend-mapper': 4,
  'opportunity': 3,
  'value-prop': 3,
  'customer-segment': 3,
  'business-model': 5,
}
