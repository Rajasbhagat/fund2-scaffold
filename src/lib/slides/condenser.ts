import 'server-only'
import { generateText } from 'ai'
import { createVertex } from '@ai-sdk/google-vertex'
import { z } from 'zod'
import { trendMapperSlideSchema } from './schemas'
import type { FieldCheck } from './validation'

type SlideData = z.infer<typeof trendMapperSlideSchema>

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
})

/**
 * Context for each field so Gemini understands where it appears in the slide sentence.
 * This helps it condense intelligently rather than just truncating.
 */
const FIELD_CONTEXT: Partial<Record<keyof SlideData, string>> = {
  trendTitle:         'Used as the main slide title at the top (36pt bold headline)',
  ventureName:        'Used as the student team name / venture name below the title',
  industry:           'Fills "[industry]" in: "We are observing a growing shift in [industry], where..."',
  trendBehavior:      'Fills "[complete]" in: "...where [complete] is becoming increasingly common among..."',
  targetUser:         'Fills "[target user]" in: "...common among [target user]." and "How might we help [target user] to..."',
  dataPoint1:         'Bullet point 1 in the supporting evidence section',
  dataPoint2:         'Bullet point 2 in the supporting evidence section',
  dataPoint3:         'Bullet point 3 in the supporting evidence section',
  drivers:            'Fills "[three drivers]" in: "This shift is being driven by [three drivers]."',
  futureImpact:       'Fills "[behavior/market/industry impact]" in: "If this trend continues, we may see [impact], leading to..."',
  opportunitiesRisks: 'Fills "[new risks, opportunities, etc]" in: "...leading to [new risks, opportunities, etc]."',
  hmwGoal:            'Fills "[need or goal]" in: "How might we help [user] to [need or goal] given [this trend]?"',
  hmwTrend:           'Fills "[this trend]" in: "How might we help [user] to [goal] given [this trend]?"',
}

export interface CondenserResult {
  data: SlideData
  condensedFields: Array<{
    field: keyof SlideData
    label: string
    original: string
    condensed: string
  }>
}

/**
 * Gemini agent that rewrites overflowed slide fields to fit within their shape bounds.
 * Preserves meaning while reducing character count to ≤ the stated limit.
 */
export async function condenseTrendMapperFields(
  data: SlideData,
  overflowed: FieldCheck[],
): Promise<CondenserResult> {
  if (overflowed.length === 0) {
    return { data, condensedFields: [] }
  }

  const fieldDescriptions = overflowed
    .map((f) => {
      const context = FIELD_CONTEXT[f.field] ?? `Slide field: ${f.field}`
      return [
        `FIELD: ${f.field}`,
        `CONTEXT: ${context}`,
        `CURRENT VALUE (${f.value.length} chars): "${f.value}"`,
        `MAX ALLOWED: ${f.limit} chars`,
        `MUST REDUCE BY: ${f.excessChars} chars`,
      ].join('\n')
    })
    .join('\n\n')

  const systemPrompt = `You are a PowerPoint slide editor. Your job is to shorten text fields that are too long to fit inside their slide text boxes, without losing the core meaning.

Rules:
- Return ONLY a JSON object with the field names as keys and shortened strings as values
- Each value MUST be ≤ its stated character limit — count carefully
- Preserve specific numbers, percentages, company names, and key facts
- Drop filler words, articles, and overly formal phrasing
- Use concise noun phrases where possible (e.g. "aging demographics" not "the aging of the demographic population")
- Do NOT truncate with "..." — produce complete, natural phrases
- Output only valid JSON, no markdown, no explanation`

  const userMessage = `Please condense these slide fields to fit within their character limits:\n\n${fieldDescriptions}\n\nReturn a JSON object with only these keys: ${overflowed.map((f) => f.field).join(', ')}`

  let condensedValues: Partial<Record<keyof SlideData, string>> = {}

  try {
    const result = await generateText({
      model: vertex('gemini-2.5-flash'),
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    })

    // Extract JSON from response (Gemini sometimes wraps in markdown)
    const jsonMatch = result.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      condensedValues = JSON.parse(jsonMatch[0]) as Partial<Record<keyof SlideData, string>>
    }
  } catch {
    // On any failure, return original data — never block generation
    return { data, condensedFields: [] }
  }

  // Merge condensed values back; fall back to original if Gemini skipped a field
  const condensedData = { ...data }
  const condensedFields: CondenserResult['condensedFields'] = []

  for (const f of overflowed) {
    const newValue = condensedValues[f.field]
    if (typeof newValue === 'string' && newValue.length > 0 && newValue !== f.value) {
      // Final safety clamp — if Gemini still returns something over limit, hard-trim at word boundary
      const clamped = newValue.length <= f.limit
        ? newValue
        : newValue.slice(0, f.limit).replace(/\s+\S*$/, '')  // trim to last complete word
      ;(condensedData as Record<string, unknown>)[f.field] = clamped
      condensedFields.push({
        field: f.field,
        label: f.label,
        original: f.value,
        condensed: clamped,
      })
    }
  }

  return { data: condensedData, condensedFields }
}
