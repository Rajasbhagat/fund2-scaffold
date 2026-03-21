import { prisma } from '@/lib/prisma'
import ProjectLayout from '@/components/ProjectLayout'

export default async function ProjectPageLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: 'desc' },
    select: { id: true, name: true },
  })

  return <ProjectLayout projects={projects}>{children}</ProjectLayout>
}
