'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Components } from 'react-markdown'

interface MessageBubbleProps {
  role: 'user' | 'model'
  content: string
}

const mdComponents: Components = {
  h1: ({ children }) => (
    <h1
      className="text-[15px] font-bold tracking-[0.08em] uppercase mt-5 mb-3 pb-1.5 font-sans"
      style={{
        color: '#ebff00',
        borderBottom: '1px solid rgba(235,255,0,0.2)',
      }}
    >
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2
      className="text-sm font-semibold tracking-[0.06em] uppercase mt-4 mb-2 font-sans"
      style={{ color: 'rgba(235,255,0,0.75)' }}
    >
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3
      className="text-sm font-semibold mt-3 mb-1.5 font-sans"
      style={{ color: '#d2edea' }}
    >
      {children}
    </h3>
  ),

  p: ({ children }) => (
    <p className="text-sm leading-[1.8] mb-3 last:mb-0" style={{ color: '#d2edea' }}>
      {children}
    </p>
  ),

  strong: ({ children }) => (
    <strong className="font-semibold" style={{ color: '#d2edea' }}>{children}</strong>
  ),
  em: ({ children }) => (
    <em style={{ color: '#b1dbd8' }}>{children}</em>
  ),

  // Inline vs block code — react-markdown passes className for fenced blocks
  code: ({ children, className }) => {
    if (className) {
      // inside a <pre>, just render passthrough
      return <code className={`font-mono text-xs`} style={{ color: '#d2edea' }}>{children}</code>
    }
    return (
      <code
        className="font-mono text-[0.8em] px-1.5 py-0.5"
        style={{
          color: '#ebff00',
          background: 'rgba(235,255,0,0.08)',
          borderRadius: 0,
        }}
      >
        {children}
      </code>
    )
  },

  pre: ({ children }) => (
    <pre
      className="font-mono text-xs leading-relaxed my-3 p-4 overflow-x-auto"
      style={{
        background: '#0d1117',
        border: '1px solid rgba(177,219,216,0.15)',
        borderRadius: 0,
        color: '#d2edea',
      }}
    >
      {children}
    </pre>
  ),

  ul: ({ children }) => (
    <ul className="my-3 space-y-2">{children}</ul>
  ),

  ol: ({ children }) => (
    <ol className="my-3 space-y-2 list-decimal list-inside" style={{ color: '#d2edea' }}>
      {children}
    </ol>
  ),

  li: ({ children, ordered, index }: { children?: React.ReactNode; ordered?: boolean; index?: number }) => (
    <li className="flex gap-2.5 text-sm leading-[1.7]" style={{ color: '#d2edea' }}>
      {!ordered && (
        <span className="shrink-0 mt-1 text-[10px] font-mono" style={{ color: 'rgba(235,255,0,0.5)' }}>
          —
        </span>
      )}
      <span className="flex-1">{children}</span>
    </li>
  ),

  blockquote: ({ children }) => (
    <blockquote
      className="my-3 pl-4 italic text-sm leading-relaxed"
      style={{
        borderLeft: '2px solid rgba(235,255,0,0.35)',
        color: '#b1dbd8',
      }}
    >
      {children}
    </blockquote>
  ),

  hr: () => (
    <div className="my-5" style={{ height: 1, background: 'rgba(177,219,216,0.15)' }} />
  ),

  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="underline underline-offset-2 transition-colors hover:opacity-100"
      style={{ color: 'rgba(235,255,0,0.75)', textDecorationColor: 'rgba(235,255,0,0.3)' }}
    >
      {children}
    </a>
  ),

  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full text-xs border-collapse" style={{ borderColor: 'rgba(177,219,216,0.15)' }}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead style={{ borderBottom: '1px solid rgba(235,255,0,0.2)' }}>{children}</thead>
  ),
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => (
    <tr style={{ borderBottom: '1px solid rgba(177,219,216,0.08)' }}>{children}</tr>
  ),
  th: ({ children }) => (
    <th
      className="text-left px-3 py-2 text-[10px] tracking-[0.15em] uppercase font-semibold font-sans"
      style={{ color: 'rgba(235,255,0,0.65)' }}
    >
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 align-top text-xs leading-relaxed" style={{ color: 'rgba(210,237,234,0.8)' }}>
      {children}
    </td>
  ),
}

export default function MessageBubble({ role, content }: MessageBubbleProps) {
  if (role === 'user') {
    return (
      <div
        className="px-4 py-3 text-sm leading-[1.75] max-w-[70%]"
        style={{
          border: '1px solid rgba(177,219,216,0.25)',
          background: 'rgba(177,219,216,0.07)',
          color: '#d2edea',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {content}
      </div>
    )
  }

  return (
    <div
      className="px-5 py-4 text-sm max-w-[82%]"
      style={{
        border: '1px solid rgba(235,255,0,0.1)',
        background: 'rgba(235,255,0,0.015)',
        wordBreak: 'break-word',
      }}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
        {content}
      </ReactMarkdown>
    </div>
  )
}
