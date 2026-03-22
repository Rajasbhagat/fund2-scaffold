export const runtime = 'nodejs';
export const maxDuration = 60;

import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { filterMessagesForSlide } from '@/lib/slides/utils';
import { SLIDE_PROMPTS } from '@/lib/slides/prompts';
import { validateTrendMapperFields, getOverflowedFields } from '@/lib/slides/validation';
import { condenseTrendMapperFields } from '@/lib/slides/condenser';
import {
  trendMapperSlideSchema,
  opportunitySlideSchema,
  valuePropSlideSchema,
  customerSegmentSlideSchema,
  businessModelSlideSchema,
} from '@/lib/slides/schemas';
import {
  buildTrendMapperSlide,
  buildOpportunitySlide,
  buildValuePropSlide,
  buildCustomerSegmentSlide,
  buildBusinessModelSlide,
} from '@/lib/slides/builders';
import type { SlideType } from '@/lib/slides/thresholds';

const VALID_SLIDE_TYPES: SlideType[] = [
  'trend-mapper',
  'opportunity',
  'value-prop',
  'customer-segment',
  'business-model',
];

function isValidSlideType(type: string): type is SlideType {
  return (VALID_SLIDE_TYPES as string[]).includes(type);
}

function getSchemaForSlideType(type: SlideType) {
  switch (type) {
    case 'trend-mapper': return trendMapperSlideSchema;
    case 'opportunity': return opportunitySlideSchema;
    case 'value-prop': return valuePropSlideSchema;
    case 'customer-segment': return customerSegmentSlideSchema;
    case 'business-model': return businessModelSlideSchema;
  }
}

function isAllCoreFieldsNull(data: Record<string, unknown>): boolean {
  return Object.entries(data)
    .filter(([key]) => key !== 'ventureName' && key !== 'trendTitle')
    .every(([, value]) => value === null);
}

/**
 * Returns which of the 5 template items are missing for the trend-mapper slide.
 * Each item requires at least its primary field to be non-null.
 */
function getTrendMapperMissing(data: z.infer<typeof trendMapperSlideSchema>): string[] {
  const missing: string[] = [];
  if (!data.industry || !data.trendBehavior || !data.targetUser) missing.push('Trend Observation (item 1)');
  if (!data.dataPoint1) missing.push('Supporting Evidence (item 2)');
  if (!data.drivers) missing.push('Key Drivers (item 3)');
  if (!data.futureImpact) missing.push('Future Impact (item 4)');
  if (!data.hmwGoal || !data.hmwTrend) missing.push('HMW Question (item 5)');
  return missing;
}

async function buildSlide(type: SlideType, data: unknown): Promise<Buffer> {
  switch (type) {
    case 'trend-mapper':
      return buildTrendMapperSlide(data as z.infer<typeof trendMapperSlideSchema>);
    case 'opportunity':
      return buildOpportunitySlide(data as z.infer<typeof opportunitySlideSchema>);
    case 'value-prop':
      return buildValuePropSlide(data as z.infer<typeof valuePropSlideSchema>);
    case 'customer-segment':
      return buildCustomerSegmentSlide(data as z.infer<typeof customerSegmentSlideSchema>);
    case 'business-model':
      return buildBusinessModelSlide(data as z.infer<typeof businessModelSlideSchema>);
  }
}

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ type: string; projectId: string }> }
) {
  const { type: rawType } = await params;

  if (!isValidSlideType(rawType)) {
    return NextResponse.json({ error: `Unknown slide type: ${rawType}` }, { status: 400 });
  }

  const type: SlideType = rawType;
  const body = await request.json() as { phase?: string; messages?: unknown[]; data?: unknown };
  const { phase, messages } = body;

  // ── Trend-mapper: phase=generate — build PPTX from pre-confirmed client data ──
  if (type === 'trend-mapper' && phase === 'generate') {
    try {
      const parsed = trendMapperSlideSchema.parse(body.data);
      const buffer = await buildTrendMapperSlide(parsed);
      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': 'attachment; filename="fund2-trend-mapper-slide.pptx"',
          'Content-Length': String(buffer.byteLength),
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  // ── Common: run Gemini extraction ──
  if (!messages) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 });
  }

  const filteredMessages = filterMessagesForSlide(messages as Parameters<typeof filterMessagesForSlide>[0], type);
  const schema = getSchemaForSlideType(type);

  try {
    const result = await generateText({
      model: vertex('gemini-2.5-flash'),
      system: SLIDE_PROMPTS[type],
      messages: filteredMessages.map((m) => ({
        role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: m.content,
      })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      output: Output.object({ schema: schema as any }),
    });

    const data = result.output as Record<string, unknown>;

    // ── Trend-mapper: phase=extract — validate alignment + condense, return for confirmation ──
    if (type === 'trend-mapper' && phase === 'extract') {
      const extracted = data as z.infer<typeof trendMapperSlideSchema>;
      const missing = getTrendMapperMissing(extracted);

      // Run field-length validation and condense any overflow with Gemini
      const checks = validateTrendMapperFields(extracted);
      const overflowed = getOverflowedFields(checks);
      const { data: validatedData, condensedFields } = await condenseTrendMapperFields(extracted, overflowed);

      return NextResponse.json({ data: validatedData, missing, condensedFields });
    }

    // ── All other slide types: check + build immediately ──
    if (isAllCoreFieldsNull(data)) {
      return NextResponse.json(
        {
          ready: false,
          reason: `Not enough information to generate a ${type} slide yet. Continue the conversation to cover the key topics for this slide.`,
        },
        { status: 422 }
      );
    }

    const buffer = await buildSlide(type, data);
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'Content-Disposition': `attachment; filename="fund2-${type}-slide.pptx"`,
        'Content-Length': String(buffer.byteLength),
      },
    });
  } catch (err) {
    if (err instanceof NoObjectGeneratedError) {
      return NextResponse.json({ ready: false, reason: err.message }, { status: 422 });
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
