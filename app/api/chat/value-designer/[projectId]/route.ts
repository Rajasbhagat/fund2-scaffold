export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { streamText, type ModelMessage } from 'ai';
import { createVertex } from '@ai-sdk/google-vertex';
import { NextResponse } from 'next/server';
import { getValueDesignerContext } from '@/lib/context';
import { prisma } from '@/lib/prisma';

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
});

const AGENT_TYPE = 'value-designer';

const FIRST_KEEP = 4;  // first 2 turns (4 messages)
const LAST_KEEP = 40;  // last 20 turns (40 messages)
const MAX_MESSAGES = FIRST_KEEP + LAST_KEEP;

function applyRollingWindow<T>(messages: T[]): T[] {
  if (messages.length <= MAX_MESSAGES) return messages;
  return [...messages.slice(0, FIRST_KEEP), ...messages.slice(messages.length - LAST_KEEP)];
}

interface ClientMessage {
  role: string;
  content: string;
  agentType?: string | null;
}

function mergeConsecutiveSameRole(messages: ClientMessage[]): ClientMessage[] {
  return messages.reduce<ClientMessage[]>((acc, msg) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.role === msg.role) {
      acc[acc.length - 1] = { ...prev, content: prev.content + '\n\n' + msg.content };
      return acc;
    }
    acc.push(msg);
    return acc;
  }, []);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  const { projectId } = await params;
  const { messages: clientHistory, currentSession = 1, deepResearch = false } = await request.json();

  const userMessageContent: string = clientHistory[clientHistory.length - 1].content;

  // Apply rolling window then merge consecutive same-role messages
  const windowed = applyRollingWindow(clientHistory as ClientMessage[]);
  const merged = mergeConsecutiveSameRole(windowed);

  // Build history for Vertex AI (exclude last message — sent separately)
  const historyMessages: ModelMessage[] = merged.slice(0, -1).map((msg) => ({
    role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
    content: msg.content,
  }));

  // Persist user message to DB
  await prisma.message.create({
    data: { projectId, agentType: AGENT_TYPE, role: 'user', content: userMessageContent },
  });

  const uploadedFiles = await prisma.uploadedFile.findMany({
    where: { projectId },
    select: { originalName: true, extractedText: true },
    orderBy: { createdAt: 'asc' },
  });

  const vdContext = getValueDesignerContext();
  let systemWithSession = `${vdContext}\n\n[Current FUND II Session: ${currentSession} of 10]`;

  if (uploadedFiles.length > 0) {
    const uploadedDocsBlock = uploadedFiles
      .map((f) => `=== UPLOADED DOCUMENT: ${f.originalName} ===\n${f.extractedText}`)
      .join('\n\n');
    systemWithSession +=
      '\n\n[STUDENT UPLOADED DOCUMENTS — Highest priority context. Consult these before running web search.]\n\n' +
      uploadedDocsBlock;
  }

  try {
    const result = streamText({
      model: vertex('gemini-2.5-flash'),
      system: systemWithSession,
      messages: [
        ...historyMessages,
        { role: 'user' as const, content: userMessageContent },
      ],
      onFinish: async (event) => {
        await prisma.message.create({
          data: { projectId, agentType: AGENT_TYPE, role: 'model', content: event.text },
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
