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
    <div className="p-4 border-t border-gray-200">
      <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
        FUND II Session
      </label>
      <select
        value={sessionNumber}
        onChange={(e) => setSessionNumber(Number(e.target.value))}
        className="w-full text-sm border border-gray-300 rounded-md px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <option key={n} value={n}>
            Session {n}
          </option>
        ))}
      </select>
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
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          ${sidebarOpen ? 'flex' : 'hidden'}
          lg:flex
          flex-col w-64 shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto
        `}
      >
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <Link href="/" className="text-sm font-semibold text-gray-700 hover:text-gray-900">
            ← Dashboard
          </Link>
          <button
            className="lg:hidden text-gray-500 hover:text-gray-700 p-1"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>
        <nav className="p-2 flex-1">
          <p className="px-2 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">
            Projects
          </p>
          <ul className="mt-1 space-y-0.5">
            {projects.map((project) => {
              const isActive = pathname === `/projects/${project.id}`
              return (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    onClick={() => setSidebarOpen(false)}
                    className={`
                      block px-3 py-2 rounded-md text-sm truncate
                      ${
                        isActive
                          ? 'bg-blue-100 text-blue-700 font-medium'
                          : 'text-gray-700 hover:bg-gray-200'
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
        <SessionSelector />
      </aside>

      {/* Main content */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Mobile header with toggle */}
        <div className="lg:hidden flex items-center gap-2 px-4 py-2 border-b border-gray-200 bg-white shrink-0">
          <button
            className="p-1 text-gray-600 hover:text-gray-900"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open sidebar"
          >
            ☰
          </button>
          <span className="text-sm font-medium text-gray-700">Projects</span>
        </div>
        <div className="flex-1 overflow-hidden">{children}</div>
      </div>
    </div>
    </SessionProvider>
  )
}
