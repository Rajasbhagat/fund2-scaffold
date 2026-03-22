'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { SessionProvider, useSession } from '@/contexts/SessionContext'

interface Project {
  id: string
  name: string
}

function SessionSelector() {
  const { sessionNumber, setSessionNumber } = useSession()
  return (
    <div className="px-4 py-3 border-t border-hud-panel/15">
      <p className="text-[10px] tracking-[0.2em] text-hud-panel/40 uppercase mb-1.5 font-sans">
        SESSION
      </p>
      <div className="grid grid-cols-5 gap-0.5 mb-1.5">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => setSessionNumber(n)}
            className={`
              font-mono text-[10px] py-1 text-center transition-colors border
              ${
                sessionNumber === n
                  ? 'bg-hud-accent text-hud-fg border-hud-accent'
                  : 'bg-transparent text-hud-panel/40 border-hud-panel/15 hover:text-hud-panel hover:border-hud-panel/30'
              }
            `}
          >
            {String(n).padStart(2, '0')}
          </button>
        ))}
      </div>
      <p className="font-mono text-[10px] text-hud-panel/40">
        SES-{String(sessionNumber).padStart(2, '0')}
      </p>
    </div>
  )
}

export default function ProjectLayout({
  projects,
  children,
}: {
  projects: Project[]
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <SessionProvider>
      <div className="flex h-screen overflow-hidden bg-hud-fg">
        {/* Sidebar */}
        <aside
          className={`
            ${sidebarOpen ? 'flex' : 'hidden'}
            lg:flex
            flex-col w-52 shrink-0 border-r border-hud-panel/15 bg-hud-fg overflow-y-auto
          `}
        >
          {/* Header */}
          <div className="px-4 py-3 border-b border-hud-panel/15 flex items-center justify-between">
            <Link
              href="/"
              className="text-[10px] tracking-[0.2em] text-hud-panel/50 uppercase hover:text-hud-accent transition-colors font-sans"
            >
              ← DASHBOARD
            </Link>
            <button
              className="lg:hidden text-hud-panel/50 hover:text-hud-bg p-1"
              onClick={() => setSidebarOpen(false)}
              aria-label="Close sidebar"
            >
              ✕
            </button>
          </div>

          {/* Nav */}
          <nav className="p-2 flex-1">
            <p className="px-2 py-2 text-[10px] tracking-[0.2em] text-hud-panel/30 uppercase font-sans">
              NODES
            </p>
            <ul className="space-y-0.5">
              {projects.map((project) => {
                const isActive = pathname === `/projects/${project.id}`
                return (
                  <li key={project.id}>
                    <Link
                      href={`/projects/${project.id}`}
                      onClick={() => setSidebarOpen(false)}
                      className={`
                        block px-3 py-2 text-xs truncate transition-colors tracking-wide border-l-2
                        ${
                          isActive
                            ? 'text-hud-accent border-hud-accent bg-hud-accent/5'
                            : 'text-hud-panel/60 border-transparent hover:text-hud-bg hover:border-hud-panel/30'
                        }
                      `}
                    >
                      {project.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Brand mark */}
          <div className="px-4 py-2">
            <span className="text-[10px] tracking-[0.25em] text-hud-panel/15 uppercase font-sans">
              ◈ FUND II
            </span>
          </div>

          <SessionSelector />
        </aside>

        {/* Main content */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {/* Mobile toggle */}
          <div className="lg:hidden flex items-center gap-3 px-4 py-2 border-b border-hud-panel/15 bg-hud-fg shrink-0">
            <button
              className="text-hud-panel/50 hover:text-hud-bg transition-colors"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
            >
              ☰
            </button>
            <span className="text-[10px] tracking-[0.2em] text-hud-panel/40 uppercase font-sans">
              NODES
            </span>
          </div>
          <div className="flex-1 overflow-hidden">{children}</div>
        </div>
      </div>
    </SessionProvider>
  )
}
