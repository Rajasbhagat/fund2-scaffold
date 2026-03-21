export const runtime = 'nodejs';

import { VertexAI } from '@google-cloud/vertexai';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const vertexai = new VertexAI({
      project: process.env.GOOGLE_CLOUD_PROJECT!,
      location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
    });

    const model = vertexai.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const result = await model.generateContent('Hello, respond with just the word READY');
    const response = result.response;
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    return NextResponse.json({ ok: true, response: text });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
