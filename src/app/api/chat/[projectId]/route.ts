export const runtime = 'nodejs';

import { streamText } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
});

export async function POST(request: Request) {
  await request.json(); // reads { messages } — will be used in US-004

  const result = streamText({
    model: vertex('gemini-2.5-flash'),
    prompt: 'Respond with just the phrase: STREAM OK',
  });

  const response = result.toTextStreamResponse();

  const headers = new Headers(response.headers);
  headers.set('X-Accel-Buffering', 'no');
  headers.set('Cache-Control', 'no-cache');
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(response.body, {
    status: response.status,
    headers,
  });
}
