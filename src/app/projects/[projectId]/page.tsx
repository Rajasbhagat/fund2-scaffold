import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ChatWindow from '@/components/ChatWindow'

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

  return (
    <main className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <h1 className="text-xl font-bold">{project.name}</h1>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatWindow projectId={projectId} initialMessages={messages} />
      </div>
    </main>
  )
}
