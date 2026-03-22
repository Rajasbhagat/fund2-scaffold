import { prisma } from '@/lib/prisma'
import ProjectList from '@/components/ProjectList'
import { HUDAccentBlock, DotGrid, HUDLabel, HUDValue, Barcode } from '@/components/hud'

export default async function Home() {
  const projects = await prisma.project.findMany({ orderBy: { updatedAt: 'desc' } })

  const serialized = projects.map((p) => ({
    id: p.id,
    name: p.name,
    updatedAt: p.updatedAt.toISOString(),
  }))

  return (
    <main className="min-h-screen bg-hud-fg flex flex-col">
      {/* Top header bar */}
      <header className="border-b border-hud-panel/20 shrink-0">
        <HUDAccentBlock className="px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-hud-fg text-base leading-none">◈</span>
            <span className="text-hud-fg font-semibold tracking-[0.25em] text-sm uppercase font-sans">
              FUND II
            </span>
            <span className="text-hud-fg/30 text-xs">|</span>
            <span className="text-hud-fg/70 tracking-[0.15em] text-xs uppercase font-sans">
              TREND INTELLIGENCE PLATFORM
            </span>
          </div>
          <div className="text-[10px] font-mono text-hud-fg/60 tracking-widest">
            {new Date().toISOString().slice(0, 10)}
          </div>
        </HUDAccentBlock>
      </header>

      {/* 2-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 border-r border-hud-panel/20 shrink-0 flex flex-col">
          <DotGrid className="flex-1 p-5 flex flex-col gap-6">
            <div>
              <HUDLabel className="mb-2">System</HUDLabel>
              <HUDValue>FUND II v2.0</HUDValue>
            </div>
            <div>
              <HUDLabel className="mb-2">Status</HUDLabel>
              <HUDValue className="text-hud-accent">ONLINE</HUDValue>
            </div>
            <div>
              <HUDLabel className="mb-2">Platform</HUDLabel>
              <HUDValue>IESE MBA</HUDValue>
            </div>
            <div className="mt-auto">
              <Barcode />
            </div>
          </DotGrid>
        </aside>

        {/* Main content */}
        <div className="flex-1 px-8 py-10 overflow-y-auto">
          <ProjectList initialProjects={serialized} />
        </div>
      </div>
    </main>
  )
}
