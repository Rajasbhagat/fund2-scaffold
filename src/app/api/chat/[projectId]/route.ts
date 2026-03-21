export const runtime = 'nodejs';

import { streamText } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import { getSystemContext } from '@/lib/context';

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
});

export async function POST(request: Request) {
  const { messages } = await request.json();

  const systemContext = getSystemContext();

  const result = streamText({
    model: vertex('gemini-2.5-flash'),
    system: systemContext,
    messages,
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
