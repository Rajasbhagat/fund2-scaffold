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
    <div className="flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
        placeholder="NODE DESIGNATION"
        className="
          flex-1 bg-transparent border border-hud-panel/25 px-4 py-2.5
          text-sm text-hud-bg placeholder:text-hud-panel/25
          focus:outline-none focus:border-hud-accent/60
          tracking-wide transition-colors font-sans
        "
        disabled={loading}
      />
      <button
        onClick={handleCreate}
        disabled={loading || !name.trim()}
        className="
          px-6 py-2.5 bg-hud-accent text-hud-fg text-xs font-bold tracking-[0.2em] uppercase font-sans
          hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed
          transition-opacity
        "
      >
        {loading ? '···' : '+ INIT'}
      </button>
    </div>
  )
}
