import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import AgentWorkspace from '@/components/AgentWorkspace'

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>
}) {
  const { projectId } = await params
  const project = await prisma.project.findUnique({ where: { id: projectId } })

  if (!project) {
    notFound()
  }

  const messages = await prisma.message.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  })

  const initialMessages = messages.map((m) => ({
    ...m,
    role: m.role === 'model' ? 'assistant' : m.role,
  }))

  return (
    <main className="flex flex-col h-full bg-[#1a2024]">
      <div className="px-4 py-2 border-b border-[#b1dbd8]/20 shrink-0 flex items-center gap-2">
        <span
          className="text-[#ebff00] text-sm leading-none"
          style={{ fontFamily: "'Rajdhani', sans-serif" }}
        >
          ◈
        </span>
        <h1
          className="text-xs font-semibold text-[#d2edea] tracking-[0.2em] uppercase"
          style={{ fontFamily: "'Rajdhani', sans-serif" }}
        >
          {project.name}
        </h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <AgentWorkspace projectId={projectId} initialMessages={initialMessages} />
      </div>
    </main>
  )
}
