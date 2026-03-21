'use client'

import Link from 'next/link'
import { useState } from 'react'

interface Project {
  id: string
  name: string
  updatedAt: string
}

interface ProjectCardProps {
  project: Project
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
}

export default function ProjectCard({ project, onRename, onDelete }: ProjectCardProps) {
  const [renaming, setRenaming] = useState(false)
  const [nameInput, setNameInput] = useState(project.name)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleRename() {
    const trimmed = nameInput.trim()
    if (!trimmed || trimmed === project.name) {
      setRenaming(false)
      setNameInput(project.name)
      return
    }
    setLoading(true)
    const res = await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    setLoading(false)
    if (res.ok) {
      onRename(project.id, trimmed)
      setRenaming(false)
    }
  }

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' })
    setLoading(false)
    if (res.ok) {
      onDelete(project.id)
    }
  }

  return (
    <li>
      {renaming ? (
        <>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <button onClick={handleRename} disabled={loading}>Save</button>
          <button onClick={() => { setRenaming(false); setNameInput(project.name) }}>Cancel</button>
        </>
      ) : (
        <>
          <span>{project.name}</span>
          <Link href={`/projects/${project.id}`}>Open</Link>
          <button onClick={() => setRenaming(true)} disabled={loading}>Rename</button>
          {confirmDelete ? (
            <>
              <span>Are you sure?</span>
              <button onClick={handleDelete} disabled={loading}>Yes, delete</button>
              <button onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button onClick={() => setConfirmDelete(true)} disabled={loading}>Delete</button>
          )}
        </>
      )}
    </li>
  )
}
