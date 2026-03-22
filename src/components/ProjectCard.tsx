'use client'

import Link from 'next/link'
import { useState } from 'react'
import { HUDPanel } from '@/components/hud'

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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
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
    if (res.ok) onDelete(project.id)
  }

  return (
    <li className="list-none">
      <HUDPanel className="border border-hud-panel/20 bg-hud-fg p-4 hover:border-hud-panel/40 transition-colors">
        {/* Accent strip at top */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-hud-accent/60" />

        {renaming ? (
          <div className="flex flex-col gap-3 mt-1">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              autoFocus
              className="
                bg-transparent border-b border-hud-accent/60 text-hud-bg text-sm
                focus:outline-none w-full pb-1 tracking-wide
              "
            />
            <div className="flex gap-3">
              <button
                onClick={handleRename}
                disabled={loading}
                className="text-[10px] text-hud-accent tracking-[0.2em] uppercase font-sans disabled:opacity-40"
              >
                SAVE
              </button>
              <button
                onClick={() => { setRenaming(false); setNameInput(project.name) }}
                className="text-[10px] text-hud-panel/40 tracking-[0.2em] uppercase font-sans"
              >
                CANCEL
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-4 mt-1">
              <div className="text-hud-bg text-sm font-semibold tracking-wide truncate font-sans">
                {project.name}
              </div>
              <div className="text-hud-panel/40 text-[10px] font-mono mt-1 tracking-wider">
                UPD {timeAgo(project.updatedAt)}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-hud-panel/10">
              <Link
                href={`/projects/${project.id}`}
                className="text-[10px] text-hud-accent tracking-[0.2em] uppercase hover:opacity-80 transition-opacity font-sans"
              >
                ACCESS →
              </Link>
              <button
                onClick={() => setRenaming(true)}
                disabled={loading}
                className="text-[10px] text-hud-panel/40 tracking-[0.2em] uppercase hover:text-hud-panel disabled:opacity-30 transition-colors font-sans"
              >
                RENAME
              </button>
              {confirmDelete ? (
                <>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="text-[10px] text-red-400 tracking-[0.2em] uppercase disabled:opacity-30 font-sans"
                  >
                    CONFIRM
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="text-[10px] text-hud-panel/40 tracking-[0.2em] uppercase font-sans"
                  >
                    ABORT
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  disabled={loading}
                  className="text-[10px] text-hud-panel/30 tracking-[0.2em] uppercase hover:text-red-400 disabled:opacity-30 ml-auto transition-colors font-sans"
                >
                  DELETE
                </button>
              )}
            </div>
          </>
        )}
      </HUDPanel>
    </li>
  )
}
