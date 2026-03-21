import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

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

  return (
    <main>
      <Link href="/">← Back to Dashboard</Link>
      <h1>{project.name}</h1>
      <p>Chat coming in Phase 3</p>
    </main>
  )
}
