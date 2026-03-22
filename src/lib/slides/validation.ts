import 'server-only'
import { z } from 'zod'
import { trendMapperSlideSchema } from './schemas'

type SlideData = z.infer<typeof trendMapperSlideSchema>

/**
 * Per-field character limits derived from shape dimensions in the template PPTX.
 *
 * EMU math: 914400 EMU = 1 inch.
 * At 16pt Calibri, ~10 chars/inch (72-DPI point space, Calibri average glyph width ~6pt).
 * At 36pt Calibri, ~4.5 chars/inch.
 *
 * Key constraints:
 * - Item1Text (cx=4901184 = 5.36", cy=475488 = ~2 lines): entire sentence must fit 2 lines.
 *   Static wrapper is ~83 chars so the three variables share ~17 extra chars — kept tight.
 * - Item3Text (cy=237744 = ~1 line): drivers must fit on one line.
 * - Item5Text (cy=237744 = ~1 line): hmwGoal + hmwTrend must be concise.
 * - Bullet points (Item2Text, cy=658368 = ~3 lines, one per bullet): each bullet is ~1 line.
 */
export const FIELD_LIMITS: Partial<Record<keyof SlideData, number>> = {
  trendTitle:        40,   // 36pt header, 5.7" wide — punchy title
  ventureName:       40,   // 16pt subtitle, 4.0" wide
  industry:          20,   // fills "[industry]" in sentence
  trendBehavior:     35,   // fills "[complete]" in sentence
  targetUser:        20,   // fills "[target user]" in sentence (used twice)
  dataPoint1:        70,   // one bullet line
  dataPoint2:        70,
  dataPoint3:        70,
  drivers:           80,   // fills "[three drivers]" — slightly more room
  futureImpact:      55,   // fills "[behavior/market/industry impact]"
  opportunitiesRisks:55,   // fills "[new risks, opportunities, etc]"
  hmwGoal:           45,   // fills "[need or goal]"
  hmwTrend:          45,   // fills "[this trend]"
}

export interface FieldCheck {
  field: keyof SlideData
  label: string              // human-readable name for UI/prompts
  value: string
  limit: number
  overflowed: boolean
  excessChars: number
}

const FIELD_LABELS: Partial<Record<keyof SlideData, string>> = {
  trendTitle:         'Trend Title',
  ventureName:        'Venture Name',
  industry:           'Industry / Domain',
  trendBehavior:      'Emerging Behavior',
  targetUser:         'Target User',
  dataPoint1:         'Data Point 1',
  dataPoint2:         'Data Point 2',
  dataPoint3:         'Data Point 3',
  drivers:            'Key Drivers',
  futureImpact:       'Future Impact',
  opportunitiesRisks: 'Opportunities & Risks',
  hmwGoal:            'HMW Goal',
  hmwTrend:           'HMW Trend Reference',
}

export function validateTrendMapperFields(data: SlideData): FieldCheck[] {
  const results: FieldCheck[] = []
  for (const [field, limit] of Object.entries(FIELD_LIMITS) as [keyof SlideData, number][]) {
    const value = data[field]
    if (typeof value !== 'string') continue
    const overflowed = value.length > limit
    results.push({
      field,
      label: FIELD_LABELS[field] ?? String(field),
      value,
      limit,
      overflowed,
      excessChars: overflowed ? value.length - limit : 0,
    })
  }
  return results
}

export function getOverflowedFields(checks: FieldCheck[]): FieldCheck[] {
  return checks.filter((c) => c.overflowed)
}
