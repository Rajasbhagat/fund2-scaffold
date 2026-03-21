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

  const [trendMapperMessages, valueDesignerMessages, spiMessages, faroMessages] =
    await Promise.all([
      prisma.message.findMany({
        where: { projectId, agentType: 'trend-mapper' },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.message.findMany({
        where: { projectId, agentType: 'value-designer' },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.message.findMany({
        where: { projectId, agentType: 'spi' },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.message.findMany({
        where: { projectId, agentType: 'faro' },
        orderBy: { createdAt: 'asc' },
      }),
    ])

  const initialMessagesByAgent = {
    'trend-mapper': trendMapperMessages,
    'value-designer': valueDesignerMessages,
    spi: spiMessages,
    faro: faroMessages,
  }

  return (
    <main className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">{project.name}</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <AgentWorkspace projectId={projectId} initialMessagesByAgent={initialMessagesByAgent} />
      </div>
    </main>
  )
}
