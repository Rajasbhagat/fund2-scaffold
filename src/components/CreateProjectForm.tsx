'use client'

import { useState } from 'react'

interface Project {
  id: string
  name: string
  updatedAt: string
}

interface CreateProjectFormProps {
  onCreate: (project: Project) => void
}

export default function CreateProjectForm({ onCreate }: CreateProjectFormProps) {
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    const trimmed = name.trim()
    if (!trimmed) return
    setLoading(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    })
    setLoading(false)
    if (res.ok) {
      const project: Project = await res.json()
      onCreate(project)
      setName('')
    }
  }

  return (
    <div>
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        placeholder="New project name"
      />
      <button onClick={handleCreate} disabled={loading || !name.trim()}>
        Create
      </button>
    </div>
  )
}
