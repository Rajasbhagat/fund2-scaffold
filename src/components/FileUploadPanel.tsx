'use client'

import { useState, useRef, useEffect } from 'react'

interface UploadedFile {
  id: string
  originalName: string
  mimeType: string
  createdAt: string
}

interface FileUploadPanelProps {
  projectId: string
}

const ACCEPT = '.pdf,.docx,.pptx'
const MAX_SIZE = 10 * 1024 * 1024 // 10MB

function fileType(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF'
  if (mimeType.includes('word')) return 'DOC'
  if (mimeType.includes('presentation')) return 'PPT'
  return 'FILE'
}

export default function FileUploadPanel({ projectId }: FileUploadPanelProps) {
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/files`)
      .then((r) => r.json())
      .then(setFiles)
      .catch(() => {})
  }, [projectId])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!e.target.value) return
    e.target.value = ''

    if (!file) return
    setError(null)

    if (file.size > MAX_SIZE) {
      setError('FILE EXCEEDS 10MB LIMIT')
      return
    }

    setUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setError(json?.error ?? 'UPLOAD FAILED')
        return
      }

      const uploaded: UploadedFile = await res.json()
      setFiles((prev) => [...prev, uploaded])
    } catch {
      setError('UPLOAD FAILED — TRY AGAIN')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(fileId: string) {
    try {
      await fetch(`/api/projects/${projectId}/files/${fileId}`, { method: 'DELETE' })
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
    } catch {
      setError('DELETE FAILED')
    }
  }

  return (
    <div className="border-t border-hud-panel/15 px-4 py-2.5 bg-hud-fg shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <span
          className="text-[10px] tracking-[0.2em] text-hud-panel/40 uppercase"
        >
          DOCUMENTS [{files.length}]
        </span>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="text-[10px] text-hud-accent/60 tracking-[0.2em] uppercase hover:text-hud-accent disabled:opacity-30 transition-colors"
        >
          {uploading ? '···' : '+ UPLOAD'}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {error && (
        <p className="text-[10px] text-red-400 mono mb-1 tracking-wide">{error}</p>
      )}

      {files.length === 0 && !uploading && (
        <p
          className="text-[10px] text-hud-panel/20 tracking-[0.2em] uppercase"
        >
          NO DOCUMENTS LOADED
        </p>
      )}

      <ul className="space-y-1 max-h-16 overflow-y-auto">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center gap-1.5 truncate" title={f.originalName}>
              <span className="text-hud-accent/40 mono text-[9px] shrink-0 tracking-wider">
                [{fileType(f.mimeType)}]
              </span>
              <span className="truncate max-w-[180px] text-hud-panel/60">{f.originalName}</span>
            </span>
            <button
              onClick={() => handleDelete(f.id)}
              className="text-hud-panel/25 hover:text-red-400 flex-shrink-0 transition-colors"
              title="Remove"
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
