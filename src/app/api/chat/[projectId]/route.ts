export const runtime = 'nodejs';

import { streamText, type ModelMessage, type ToolSet } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import { NextResponse } from 'next/server';
import { getSystemContext } from '@/lib/context';
import { prisma } from '@/lib/prisma';

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
});

const FIRST_KEEP = 4;  // first 2 turns (4 messages)
const LAST_KEEP = 40;  // last 20 turns (40 messages)
const MAX_MESSAGES = FIRST_KEEP + LAST_KEEP;

function applyRollingWindow<T>(messages: T[]): T[] {
  if (messages.length <= MAX_MESSAGES) return messages;
  return [...messages.slice(0, FIRST_KEEP), ...messages.slice(messages.length - LAST_KEEP)];
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { messages: incomingMessages, agentType = 'trend-mapper', currentSession = 1, deepResearch = false } = await request.json();

  // Extract text from the last incoming message (new user message)
  const lastIncoming = Array.isArray(incomingMessages)
    ? incomingMessages[incomingMessages.length - 1]
    : null;
  const userMessageContent: string =
    typeof lastIncoming?.content === 'string'
      ? lastIncoming.content
      : (lastIncoming?.content?.[0]?.text ?? '');

  // Load history from DB ordered oldest first
  const dbMessages = await prisma.message.findMany({
    where: { projectId, agentType },
    orderBy: { createdAt: 'asc' },
  });

  // Apply rolling window: keep first 2 turns + last 20 turns
  const windowed = applyRollingWindow(dbMessages);

  // Persist user message to DB BEFORE streaming to avoid losing it on errors
  await prisma.message.create({
    data: { projectId, agentType, role: 'user', content: userMessageContent },
  });

  // Format DB history for ai SDK ('model' -> 'assistant')
  const historyMessages: ModelMessage[] = windowed.map((msg) => ({
    role: msg.role === 'model' ? ('assistant' as const) : ('user' as const),
    content: msg.content,
  }));

  const systemContext = getSystemContext();
  const systemWithSession = `${systemContext}\n\n[Current FUND II Session: ${currentSession} of 10]`;

  const model = deepResearch ? vertex('gemini-2.5-pro') : vertex('gemini-2.5-flash');
  const tools: ToolSet = {
    google_search: vertex.tools.googleSearch({}),
    ...(deepResearch ? { url_context: vertex.tools.urlContext({}) } : {}),
  };

  try {
    const result = streamText({
      model,
      system: systemWithSession,
      tools,
      messages: [
        ...historyMessages,
        { role: 'user' as const, content: userMessageContent },
      ],
      onFinish: async (event) => {
        await prisma.message.create({
          data: { projectId, agentType, role: 'model', content: event.text },
        });
      },
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
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: message, code: 'AI_ERROR' },
      { status: 500 }
    );
  }
}
