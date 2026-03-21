'use client'

import { useState } from 'react'
import CreateProjectForm from './CreateProjectForm'
import ProjectCard from './ProjectCard'

interface Project {
  id: string
  name: string
  updatedAt: string
}

interface ProjectListProps {
  initialProjects: Project[]
}

export default function ProjectList({ initialProjects }: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>(initialProjects)

  function handleCreate(project: Project) {
    setProjects((prev) => [project, ...prev])
  }

  function handleRename(id: string, name: string) {
    setProjects((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name } : p))
    )
  }

  function handleDelete(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id))
  }

  return (
    <div>
      <CreateProjectForm onCreate={handleCreate} />
      {projects.length === 0 ? (
        <p>No projects yet</p>
      ) : (
        <ul>
          {projects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          ))}
        </ul>
      )}
    </div>
  )
}
