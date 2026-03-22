import 'server-only'
import pptxgen from 'pptxgenjs'
import JSZip from 'jszip'
import fs from 'fs'
import path from 'path'
import { z } from 'zod'
import {
  trendMapperSlideSchema,
  opportunitySlideSchema,
  valuePropSlideSchema,
  customerSegmentSlideSchema,
  businessModelSlideSchema,
} from './schemas'

const MISSING = '[Not defined — continue the conversation]'

/** Escape a string for safe insertion into XML attribute/text content */
function escXml(v: string | null, fallback = MISSING): string {
  return (v ?? fallback)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Build the Trend Mapper slide by filling the official template PPTX.
 * The template lives at public/templates/trend-mapper-template.pptx and has
 * 7 named shapes whose text we replace via XML string substitution.
 */
export async function buildTrendMapperSlide(
  data: z.infer<typeof trendMapperSlideSchema>,
): Promise<Buffer> {
  const templatePath = path.join(process.cwd(), 'public', 'templates', 'trend-mapper-template.pptx')
  const templateBuffer = fs.readFileSync(templatePath)
  const zip = await JSZip.loadAsync(templateBuffer)

  const slideFile = zip.file('ppt/slides/slide1.xml')
  if (!slideFile) throw new Error('Template PPTX is missing ppt/slides/slide1.xml')
  let xml = await slideFile.async('string')

  // Replace each named shape's placeholder text.
  // Pattern: ><a:t>PLACEHOLDER_TEXT</a:t>  →  ><a:t>REPLACEMENT</a:t>
  // [target user] appears in both Item1Text and Item5Text — replaceAll handles both.
  xml = xml.replace(/>Trend Title</g, `>${escXml(data.trendTitle)}<`)
  xml = xml.replace(/>Student Name</g, `>${escXml(data.ventureName)}<`)
  xml = xml.replace(/>\[industry\]</g, `>${escXml(data.industry)}<`)
  xml = xml.replace(/>\[complete\]</g, `>${escXml(data.trendBehavior)}<`)
  xml = xml.replace(/>\[target user\]</g, `>${escXml(data.targetUser)}<`)
  xml = xml.replace(/>Data #1</g, `>${escXml(data.dataPoint1)}<`)
  xml = xml.replace(/>Data #2</g, `>${escXml(data.dataPoint2)}<`)
  xml = xml.replace(/>Data #3</g, `>${escXml(data.dataPoint3)}<`)
  xml = xml.replace(/>\[three drivers\]</g, `>${escXml(data.drivers)}<`)
  xml = xml.replace(/>\[behavior\/market\/industry impact\]</g, `>${escXml(data.futureImpact)}<`)
  xml = xml.replace(/>\[new risks, opportunities, etc\]</g, `>${escXml(data.opportunitiesRisks)}<`)
  xml = xml.replace(/>\[need or goal\]</g, `>${escXml(data.hmwGoal)}<`)
  xml = xml.replace(/>\[this trend\]</g, `>${escXml(data.hmwTrend)}<`)

  zip.file('ppt/slides/slide1.xml', xml)
  return zip.generateAsync({ type: 'nodebuffer' }) as Promise<Buffer>
}

// ── HUD helpers for pptxgenjs-based slides (non-trend-mapper) ─────────────────

const HUD_ACCENT = 'EBFF00'
const HUD_BG = 'D2EDEA'
const HUD_FG = '1A2024'
const HUD_PANEL = 'B1DBD8'
const PLACEHOLDER_TEXT = '[Not yet defined — continue the conversation]'

function val(v: string | null | undefined): string {
  return v ?? PLACEHOLDER_TEXT
}

function createHUDSlide(pptx: pptxgen, slideLabel: string, ventureName: string | null) {
  const slide = pptx.addSlide()
  slide.background = { color: HUD_BG }
  slide.addShape(pptx.ShapeType.rect, {
    x: 0, y: 0, w: '100%', h: 0.7,
    fill: { color: HUD_ACCENT },
    line: { color: HUD_ACCENT },
  })
  slide.addText(slideLabel, {
    x: 0.3, y: 0.05, w: 6, h: 0.6,
    fontSize: 14, bold: true, color: HUD_FG, fontFace: 'Calibri',
  })
  if (ventureName) {
    slide.addText(ventureName.toUpperCase(), {
      x: 6.3, y: 0.05, w: 3.3, h: 0.6,
      fontSize: 10, color: HUD_FG, fontFace: 'Calibri', align: 'right',
    })
  }
  return slide
}

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
    fontSize: 7, color: HUD_FG, fontFace: 'Calibri', charSpacing: 2, bold: true,
  })
  slide.addText(val(value), {
    x, y: y + 0.23, w, h: 0.45,
    fontSize: 10,
    color: value ? HUD_FG : HUD_PANEL,
    fontFace: 'Calibri',
    italic: !value,
  })
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
