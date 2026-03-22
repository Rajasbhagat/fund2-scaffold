import 'server-only'
import { z } from 'zod'

export const trendMapperSlideSchema = z.object({
  ventureName: z.string().nullable(),
  trendArea: z.string().nullable(),
  keyInsight: z.string().nullable(),
  sCurvePosition: z.string().nullable(),
  opportunityMap: z.string().nullable(),
  supportingEvidence: z.string().nullable(),
  nextStep: z.string().nullable(),
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
