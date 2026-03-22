import 'server-only'
import { z } from 'zod'

// Matches the 7 named shapes in the template PPTX exactly
export const trendMapperSlideSchema = z.object({
  // Header shapes
  trendTitle: z.string().nullable(),        // "Trend Title" shape
  ventureName: z.string().nullable(),       // "Student Name" shape
  // Item 1 — observation sentence
  industry: z.string().nullable(),          // [industry]
  trendBehavior: z.string().nullable(),     // [complete] — what's becoming common
  targetUser: z.string().nullable(),        // [target user] (reused in item 5)
  // Item 2 — supporting evidence bullets
  dataPoint1: z.string().nullable(),        // Data #1
  dataPoint2: z.string().nullable(),        // Data #2
  dataPoint3: z.string().nullable(),        // Data #3
  // Item 3 — drivers
  drivers: z.string().nullable(),           // [three drivers]
  // Item 4 — future impact
  futureImpact: z.string().nullable(),      // [behavior/market/industry impact]
  opportunitiesRisks: z.string().nullable(),// [new risks, opportunities, etc]
  // Item 5 — HMW question
  hmwGoal: z.string().nullable(),           // [need or goal]
  hmwTrend: z.string().nullable(),          // [this trend]
})

export const opportunitySlideSchema = z.object({
  ventureName: z.string().nullable(),
  problemStatement: z.string().nullable(),
  targetCustomer: z.string().nullable(),
  currentAlternatives: z.string().nullable(),
  proposedSolution: z.string().nullable(),
  keyBenefit: z.string().nullable(),
})

export const valuePropSlideSchema = z.object({
  ventureName: z.string().nullable(),
  headline: z.string().nullable(),
  topBenefits: z.array(z.string().nullable()).nullable(),
  keyDifferentiator: z.string().nullable(),
  proofPoint: z.string().nullable(),
})

export const customerSegmentSlideSchema = z.object({
  ventureName: z.string().nullable(),
  segmentName: z.string().nullable(),
  demographics: z.string().nullable(),
  behaviors: z.string().nullable(),
  painPoints: z.string().nullable(),
  gainCreators: z.string().nullable(),
})

export const businessModelSlideSchema = z.object({
  ventureName: z.string().nullable(),
  revenueModel: z.string().nullable(),
  keyPartners: z.string().nullable(),
  keyActivities: z.string().nullable(),
  costStructure: z.string().nullable(),
  unfairAdvantage: z.string().nullable(),
})
