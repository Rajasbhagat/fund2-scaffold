import { ReactNode } from 'react'

interface HUDPanelProps {
  children: ReactNode
  className?: string
  accentCorners?: boolean
}

export function HUDPanel({ children, className = '', accentCorners = true }: HUDPanelProps) {
  return (
    <div className={`relative ${className}`}>
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

interface HUDLabelProps {
  children: ReactNode
  className?: string
}

export function HUDLabel({ children, className = '' }: HUDLabelProps) {
  return (
    <span className={`text-[10px] tracking-[0.2em] uppercase font-sans ${className}`}>
      {children}
    </span>
  )
}

interface HUDValueProps {
  children: ReactNode
  className?: string
}

export function HUDValue({ children, className = '' }: HUDValueProps) {
  return (
    <span className={`font-mono text-sm tracking-wide ${className}`}>
      {children}
    </span>
  )
}

interface HUDAccentBlockProps {
  children: ReactNode
  className?: string
}

export function HUDAccentBlock({ children, className = '' }: HUDAccentBlockProps) {
  return (
    <div className={`bg-hud-accent text-hud-fg ${className}`}>
      {children}
    </div>
  )
}

interface BarcodeProps {
  value?: string
  className?: string
}

export function Barcode({ value = 'FUND-II', className = '' }: BarcodeProps) {
  const bars = Array.from({ length: 20 }, (_, i) => ({
    width: [1, 2, 1, 3, 1, 2, 2, 1, 3, 1, 2, 1, 1, 2, 3, 1, 2, 1, 2, 1][i],
  }))

  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      <div className="flex items-end gap-[2px] h-6">
        {bars.map((bar, i) => (
          <div
            key={i}
            className="bg-hud-panel/60 h-full"
            style={{ width: bar.width * 2 }}
          />
        ))}
      </div>
      <HUDLabel className="text-hud-panel/60">{value}</HUDLabel>
    </div>
  )
}

interface DotGridProps {
  children: ReactNode
  className?: string
}

export function DotGrid({ children, className = '' }: DotGridProps) {
  return (
    <div className={`dot-grid ${className}`}>
      {children}
    </div>
  )
}
