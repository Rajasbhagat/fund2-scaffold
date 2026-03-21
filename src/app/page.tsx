import { prisma } from '@/lib/prisma'
import ProjectList from '@/components/ProjectList'

export default async function Home() {
  const projects = await prisma.project.findMany({ orderBy: { updatedAt: 'desc' } })

  const serialized = projects.map((p) => ({
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt.toISOString(),
  }))

  return (
    <main>
      <h1>FUND II Trend Mapper</h1>
      <ProjectList initialProjects={serialized} />
    </main>
  )
}
