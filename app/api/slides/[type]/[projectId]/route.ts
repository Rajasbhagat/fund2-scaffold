export const runtime = 'nodejs';
export const maxDuration = 60;

import { generateText, Output, NoObjectGeneratedError } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import { NextResponse } from 'next/server';
import { filterMessagesForSlide } from '@/lib/slides/utils';
import { SLIDE_PROMPTS } from '@/lib/slides/prompts';
import {
  trendMapperSlideSchema,
  opportunitySlideSchema,
  valuePropSlideSchema,
  customerSegmentSlideSchema,
  businessModelSlideSchema,
} from '@/lib/slides/schemas';
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
    case 'trend-mapper':
      return trendMapperSlideSchema;
    case 'opportunity':
      return opportunitySlideSchema;
    case 'value-prop':
      return valuePropSlideSchema;
    case 'customer-segment':
      return customerSegmentSlideSchema;
    case 'business-model':
      return businessModelSlideSchema;
  }
}

function isAllCoreFieldsNull(data: Record<string, unknown>): boolean {
  return Object.entries(data)
    .filter(([key]) => key !== 'ventureName')
    .every(([, value]) => value === null);
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
    return NextResponse.json(
      { error: `Unknown slide type: ${rawType}` },
      { status: 400 }
    );
  }

  const type: SlideType = rawType;
  const { messages } = await request.json();

  const filteredMessages = filterMessagesForSlide(messages, type);

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

    if (isAllCoreFieldsNull(data)) {
      return NextResponse.json(
        {
          ready: false,
          reason: `Not enough information to generate a ${type} slide yet. Continue the conversation to cover the key topics for this slide.`,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    if (err instanceof NoObjectGeneratedError) {
      return NextResponse.json(
        { ready: false, reason: err.message },
        { status: 422 }
      );
    }
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
