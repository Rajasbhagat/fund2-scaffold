import React from 'react'

export function HUDPanel({ children, className, accentCorners = true }: {
  children: React.ReactNode; className?: string; accentCorners?: boolean
}) {
  return (
    <div className={`relative border border-hud-panel/20 ${className ?? ''}`}>
      {accentCorners && (
        <>
          <span className="absolute top-0 left-0 w-3 h-3 border-t border-l border-hud-accent/60 pointer-events-none" />
          <span className="absolute top-0 right-0 w-3 h-3 border-t border-r border-hud-accent/60 pointer-events-none" />
          <span className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-hud-accent/60 pointer-events-none" />
          <span className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-hud-accent/60 pointer-events-none" />
        </>
      )}
      {children}
    </div>
  )
}

export function HUDLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-[10px] tracking-[0.2em] text-hud-panel/40 uppercase font-sans ${className ?? ''}`}>
      {children}
    </span>
  )
}

export function HUDValue({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`text-2xl font-bold tracking-[0.05em] text-hud-bg font-sans ${className ?? ''}`}>
      {children}
    </span>
  )
}

export function HUDAccentBlock({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-hud-accent text-hud-fg px-4 py-2 font-sans ${className ?? ''}`}>
      {children}
    </div>
  )
}

export function Barcode({ className }: { className?: string }) {
  return (
    <div
      className={`h-4 ${className ?? ''}`}
      style={{
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(177,219,216,0.3) 0px, rgba(177,219,216,0.3) 2px, transparent 2px, transparent 6px)',
      }}
    />
  )
}

export function DotGrid({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={`dot-grid ${className ?? ''}`}>{children}</div>
}
