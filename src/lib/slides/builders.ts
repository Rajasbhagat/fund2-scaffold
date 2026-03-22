import 'server-only'
import pptxgen from 'pptxgenjs'
import { z } from 'zod'
import {
  trendMapperSlideSchema,
  opportunitySlideSchema,
  valuePropSlideSchema,
  customerSegmentSlideSchema,
  businessModelSlideSchema,
} from './schemas'

// HUD color constants (no # prefix for pptxgenjs)
const HUD_ACCENT = 'EBFF00'  // neon yellow
const HUD_BG = 'D2EDEA'      // icy blue
const HUD_FG = '1A2024'      // dark slate
const HUD_PANEL = 'B1DBD8'   // panel accent (muted)

const PLACEHOLDER = '[Not yet defined — continue the conversation]'

function val(v: string | null | undefined): string {
  return v ?? PLACEHOLDER
}

// Helper: create a standard HUD slide layout
function createHUDSlide(pptx: pptxgen, slideLabel: string, ventureName: string | null) {
  const slide = pptx.addSlide()
  // Icy blue background
  slide.background = { color: HUD_BG }
  // Neon yellow header strip (full width, top)
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.7,
    fill: { color: HUD_ACCENT },
    line: { color: HUD_ACCENT },
  })
  // Slide type label in header
  slide.addText(slideLabel, {
    x: 0.3, y: 0.05, w: 6, h: 0.6,
    fontSize: 14, bold: true, color: HUD_FG, fontFace: 'Calibri',
  })
  // Venture name in header (right side)
  if (ventureName) {
    slide.addText(ventureName.toUpperCase(), {
      x: 6.3, y: 0.05, w: 3.3, h: 0.6,
      fontSize: 10, color: HUD_FG, fontFace: 'Calibri', align: 'right',
    })
  }
  return slide
}

// Helper: add a labeled field row
function addField(
  slide: pptxgen.Slide,
  label: string,
  value: string | null | undefined,
  x: number,
  y: number,
  w: number,
) {
  slide.addText(label.toUpperCase(), {
    x, y, w, h: 0.22,
    fontSize: 7, color: HUD_FG, fontFace: 'Calibri',
    charSpacing: 2, bold: true,
  })
  slide.addText(val(value), {
    x, y: y + 0.23, w, h: 0.45,
    fontSize: 10,
    color: value ? HUD_FG : HUD_PANEL,
    fontFace: 'Calibri',
    italic: !value,
  })
}

export async function buildTrendMapperSlide(
  data: z.infer<typeof trendMapperSlideSchema>,
): Promise<Buffer> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'
  const slide = createHUDSlide(pptx, 'TREND MAPPER', data.ventureName ?? null)
  // Layout: 2 columns × 3 rows of fields
  addField(slide, 'Trend Area', data.trendArea, 0.3, 0.9, 4.5)
  addField(slide, 'Key Insight', data.keyInsight, 5.1, 0.9, 4.5)
  addField(slide, 'S-Curve Position', data.sCurvePosition, 0.3, 2.0, 4.5)
  addField(slide, 'Opportunity Map', data.opportunityMap, 5.1, 2.0, 4.5)
  addField(slide, 'Supporting Evidence', data.supportingEvidence, 0.3, 3.1, 4.5)
  addField(slide, 'Next Step', data.nextStep, 5.1, 3.1, 4.5)
  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
}

export async function buildOpportunitySlide(
  data: z.infer<typeof opportunitySlideSchema>,
): Promise<Buffer> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'
  const slide = createHUDSlide(pptx, 'OPPORTUNITY', data.ventureName ?? null)
  addField(slide, 'Problem Statement', data.problemStatement, 0.3, 0.9, 9.3)
  addField(slide, 'Target Customer', data.targetCustomer, 0.3, 2.0, 4.5)
  addField(slide, 'Current Alternatives', data.currentAlternatives, 5.1, 2.0, 4.5)
  addField(slide, 'Proposed Solution', data.proposedSolution, 0.3, 3.1, 4.5)
  addField(slide, 'Key Benefit', data.keyBenefit, 5.1, 3.1, 4.5)
  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
}

export async function buildValuePropSlide(
  data: z.infer<typeof valuePropSlideSchema>,
): Promise<Buffer> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'
  const slide = createHUDSlide(pptx, 'VALUE PROPOSITION', data.ventureName ?? null)
  addField(slide, 'Headline', data.headline, 0.3, 0.9, 9.3)
  // topBenefits is an array — join non-null entries with newlines
  const benefits =
    data.topBenefits
      ?.filter((b): b is string => b !== null)
      .join('\n') ?? null
  addField(slide, 'Top Benefits', benefits || null, 0.3, 2.0, 4.5)
  addField(slide, 'Key Differentiator', data.keyDifferentiator, 5.1, 2.0, 4.5)
  addField(slide, 'Proof Point', data.proofPoint, 0.3, 3.1, 9.3)
  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
}

export async function buildCustomerSegmentSlide(
  data: z.infer<typeof customerSegmentSlideSchema>,
): Promise<Buffer> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'
  const slide = createHUDSlide(pptx, 'CUSTOMER SEGMENT', data.ventureName ?? null)
  addField(slide, 'Segment', data.segmentName, 0.3, 0.9, 4.5)
  addField(slide, 'Demographics', data.demographics, 5.1, 0.9, 4.5)
  addField(slide, 'Behaviors', data.behaviors, 0.3, 2.0, 4.5)
  addField(slide, 'Pain Points', data.painPoints, 5.1, 2.0, 4.5)
  addField(slide, 'Gain Creators', data.gainCreators, 0.3, 3.1, 9.3)
  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
}

export async function buildBusinessModelSlide(
  data: z.infer<typeof businessModelSlideSchema>,
): Promise<Buffer> {
  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_WIDE'
  const slide = createHUDSlide(pptx, 'BUSINESS MODEL', data.ventureName ?? null)
  addField(slide, 'Revenue Model', data.revenueModel, 0.3, 0.9, 4.5)
  addField(slide, 'Key Partners', data.keyPartners, 5.1, 0.9, 4.5)
  addField(slide, 'Key Activities', data.keyActivities, 0.3, 2.0, 4.5)
  addField(slide, 'Cost Structure', data.costStructure, 5.1, 2.0, 4.5)
  addField(slide, 'Unfair Advantage', data.unfairAdvantage, 0.3, 3.1, 9.3)
  return (await pptx.write({ outputType: 'nodebuffer' })) as Buffer
}
