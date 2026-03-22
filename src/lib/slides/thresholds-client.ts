// Client-safe threshold constants (no server-only imports)
export const SLIDE_THRESHOLDS: Record<string, number> = {
  'trend-mapper': 4,
  'opportunity': 3,
  'value-prop': 3,
  'customer-segment': 3,
  'business-model': 5,
}

export const SLIDE_LABELS: Record<string, string> = {
  'trend-mapper': 'TREND MAPPER SLIDE',
  'opportunity': 'OPPORTUNITY SLIDE',
  'value-prop': 'VALUE PROP SLIDE',
  'customer-segment': 'CUSTOMER SEGMENT SLIDE',
  'business-model': 'BUSINESS MODEL SLIDE',
}
