'use client'

import { useState } from 'react'

type Item = { q: string; a: string }

export function FaqAccordion({ items }: { items: Item[] }) {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {items.map((item, i) => {
        const isOpen = open === i
        return (
          <div
            key={item.q}
            style={{
              borderTop: '0.5px solid var(--bdc)',
              ...(i === items.length - 1 ? { borderBottom: '0.5px solid var(--bdc)' } : {}),
            }}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : i)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 0',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                gap: 12,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4 }}>
                {item.q}
              </span>
              <span
                style={{
                  flexShrink: 0,
                  width: 22,
                  height: 22,
                  borderRadius: '50%',
                  border: '0.5px solid var(--bdc)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 14,
                  color: 'var(--muted)',
                  transition: 'transform 0.2s',
                  transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  background: 'var(--card)',
                }}
              >
                +
              </span>
            </button>

            {isOpen && (
              <p
                style={{
                  fontSize: 13,
                  color: 'var(--muted)',
                  lineHeight: 1.7,
                  paddingBottom: 16,
                  margin: 0,
                }}
              >
                {item.a}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
