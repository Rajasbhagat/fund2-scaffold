import { prisma } from '@/lib/prisma'

export default async function Home() {
  const projects = await prisma.project.findMany({ orderBy: { updatedAt: 'desc' } })

  return (
    <main>
      <h1>FUND II Trend Mapper</h1>
      {projects.length === 0 ? (
        <p>No projects yet</p>
      ) : (
        <ul>
          {projects.map((project) => (
            <li key={project.id}>{project.name}</li>
          ))}
        </ul>
      )}
    </main>
  )
}
