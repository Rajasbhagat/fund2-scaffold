export const runtime = 'nodejs'
export const maxDuration = 60

import { generateText } from 'ai'
import { createVertex } from '@ai-sdk/google-vertex'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { LANDING_PROMPT_SYSTEM } from '@/lib/landing-prompt/system-prompt'

const vertex = createVertex({
  project: process.env.GOOGLE_CLOUD_PROJECT,
  location: process.env.GOOGLE_CLOUD_LOCATION ?? 'us-central1',
})

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params

    const dbMessages = await prisma.message.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true, agentType: true },
    })

    if (dbMessages.length === 0) {
      return NextResponse.json(
        { error: 'No conversation found for this project.' },
        { status: 422 }
      )
    }

    const messages = dbMessages.map((m) => ({
      role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
      content: m.agentType
        ? `[${m.agentType.toUpperCase()}]: ${m.content}`
        : m.content,
    }))

    const result = await generateText({
      model: vertex('gemini-2.5-flash'),
      system: LANDING_PROMPT_SYSTEM,
      messages,
    })

    return NextResponse.json({ prompt: result.text })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
