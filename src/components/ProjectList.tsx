'use client'

import { useState } from 'react'
import CreateProjectForm from './CreateProjectForm'
import ProjectCard from './ProjectCard'
import { HUDLabel } from '@/components/hud'

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
      {/* Section header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-px w-5 bg-hud-accent" />
        <HUDLabel>INTELLIGENCE NODES</HUDLabel>
        <span className="text-[10px] font-mono text-hud-panel/60">[{projects.length}]</span>
      </div>

      <CreateProjectForm onCreate={handleCreate} />

      {projects.length === 0 ? (
        <div className="mt-16 text-center">
          <HUDLabel>NO ACTIVE NODES — INITIALIZE FIRST NODE ABOVE</HUDLabel>
        </div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
