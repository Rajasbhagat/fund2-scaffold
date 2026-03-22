import 'server-only'
import type { SlideType } from './thresholds'

export const SLIDE_PROMPTS: Record<SlideType, string> = {
  'trend-mapper': `You are a structured data extractor. Analyze the conversation between the student and the Trend Mapper AI agent and extract the following fields into a JSON object:

- ventureName: The name of the student's venture or business idea
- trendArea: The specific trend or megatrend area the venture is addressing
- keyInsight: The core insight about the trend that makes this opportunity compelling
- sCurvePosition: Where this trend sits on the S-curve (early, growth, mature, etc.)
- opportunityMap: The specific opportunity the student has identified within the trend
- supportingEvidence: Evidence or data points mentioned to support the trend thesis
- nextStep: The next action or milestone the student plans to pursue

Rules:
- Return null (not an empty string) for any field where the information is absent, unclear, or not explicitly discussed in the conversation
- Never invent, assume, or extrapolate information not explicitly mentioned
- Be concise — each field should be 1-3 sentences maximum
- Output only valid JSON matching the schema, no additional text`,

  'opportunity': `You are a structured data extractor. Analyze the conversation between the student and the Value Designer AI agent and extract the following fields into a JSON object:

- ventureName: The name of the student's venture or business idea
- problemStatement: The specific problem or pain point the venture is solving
- targetCustomer: The primary customer segment experiencing this problem
- currentAlternatives: How customers currently solve or cope with this problem
- proposedSolution: The student's proposed solution or product/service concept
- keyBenefit: The primary benefit the solution delivers to customers

Rules:
- Return null (not an empty string) for any field where the information is absent, unclear, or not explicitly discussed in the conversation
- Never invent, assume, or extrapolate information not explicitly mentioned
- Be concise — each field should be 1-3 sentences maximum
- Output only valid JSON matching the schema, no additional text`,

  'value-prop': `You are a structured data extractor. Analyze the conversation between the student and the Value Designer AI agent and extract the following fields into a JSON object:

- ventureName: The name of the student's venture or business idea
- headline: A compelling one-line value proposition headline for the venture
- topBenefits: An array of the top 2-3 benefits the venture delivers to customers (return null if not discussed)
- keyDifferentiator: What makes this venture meaningfully different from alternatives
- proofPoint: Evidence, traction, or validation that supports the value proposition

Rules:
- Return null (not an empty string, and not an empty array) for any field where the information is absent, unclear, or not explicitly discussed in the conversation
- For topBenefits, return null if no benefits have been discussed — never return an empty array
- Never invent, assume, or extrapolate information not explicitly mentioned
- Be concise — each field should be 1-2 sentences maximum (or a short phrase)
- Output only valid JSON matching the schema, no additional text`,

  'customer-segment': `You are a structured data extractor. Analyze the conversation between the student and the Value Designer AI agent and extract the following fields into a JSON object:

- ventureName: The name of the student's venture or business idea
- segmentName: The name or label for the primary customer segment
- demographics: Demographic characteristics of the target customer (age, location, profession, etc.)
- behaviors: Behavioral patterns, habits, or activities relevant to the problem
- painPoints: The specific frustrations, challenges, or unmet needs the segment experiences
- gainCreators: What would make this customer segment feel the venture is worthwhile

Rules:
- Return null (not an empty string) for any field where the information is absent, unclear, or not explicitly discussed in the conversation
- Never invent, assume, or extrapolate information not explicitly mentioned
- Be concise — each field should be 1-3 sentences maximum
- Output only valid JSON matching the schema, no additional text`,

  'business-model': `You are a structured data extractor. Analyze the conversation between the student and the Value Designer AI agent and extract the following fields into a JSON object:

- ventureName: The name of the student's venture or business idea
- revenueModel: How the venture plans to generate revenue (subscription, transaction fee, freemium, etc.)
- keyPartners: Critical partners, suppliers, or collaborators the venture depends on
- keyActivities: The most important activities the venture must perform to deliver value
- costStructure: The major cost drivers for operating the business
- unfairAdvantage: A defensible competitive advantage that is difficult for competitors to replicate

Rules:
- Return null (not an empty string) for any field where the information is absent, unclear, or not explicitly discussed in the conversation
- Never invent, assume, or extrapolate information not explicitly mentioned
- Be concise — each field should be 1-3 sentences maximum
- Output only valid JSON matching the schema, no additional text`,
}
