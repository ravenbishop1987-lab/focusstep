'use client'

import { useState } from 'react'
import Link from 'next/link'
import { BrandLockup } from '@/components/brand-lockup'

type NavItem = {
  href: string
  label: string
}

type PublicHeaderProps = {
  ctaHref: string
  ctaLabel: string
  secondaryHref?: string
  secondaryLabel?: string
  navItems?: NavItem[]
}

export function PublicHeader({
  ctaHref,
  ctaLabel,
  secondaryHref,
  secondaryLabel,
  navItems = [],
}: PublicHeaderProps) {
  const [open, setOpen] = useState(false)

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: 'rgba(240, 237, 230, 0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: '0.5px solid var(--bdc)',
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
        className="md:px-6"
      >
        <div className="flex items-center gap-3">
          {navItems.length > 0 ? (
            <button
              className="mobile-only"
              onClick={() => setOpen((value) => !value)}
              type="button"
              aria-label="Toggle menu"
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                border: '0.5px solid var(--bdc)',
                background: 'var(--card)',
                color: 'var(--ink)',
                flexShrink: 0,
              }}
            >
              {open ? '×' : '☰'}
            </button>
          ) : null}
          <BrandLockup compact />
        </div>

        {navItems.length > 0 ? (
          <nav
            style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13, color: 'var(--muted)' }}
            className="hidden md:flex"
          >
            {navItems.map((item) => (
              <a href={item.href} key={item.href} style={{ color: 'var(--muted)' }}>
                {item.label}
              </a>
            ))}
          </nav>
        ) : null}

        <div className="flex items-center gap-2 sm:gap-3">
          {secondaryHref && secondaryLabel ? (
            <Link
              href={secondaryHref}
              style={{
                color: 'var(--muted)',
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
              className="hidden sm:inline-flex"
            >
              {secondaryLabel}
            </Link>
          ) : null}
          <Link
            href={ctaHref}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              borderRadius: 10,
              padding: '10px 14px',
              textDecoration: 'none',
              fontSize: 13,
              fontWeight: 600,
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {ctaLabel}
          </Link>
        </div>
      </div>

      {open && navItems.length > 0 ? (
        <div
          className="mobile-only"
          style={{
            padding: '0 16px 14px',
          }}
        >
          <div
            style={{
              maxWidth: 1120,
              margin: '0 auto',
              background: 'var(--card)',
              border: '0.5px solid var(--bdc)',
              borderRadius: 14,
              padding: 10,
              boxShadow: '0 18px 42px rgba(44, 42, 34, 0.1)',
            }}
          >
            <div className="grid gap-2">
              {navItems.map((item) => (
                <a
                  href={item.href}
                  key={item.href}
                  onClick={() => setOpen(false)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    color: 'var(--body)',
                    textDecoration: 'none',
                  }}
                >
                  {item.label}
                </a>
              ))}
              {secondaryHref && secondaryLabel ? (
                <Link
                  href={secondaryHref}
                  onClick={() => setOpen(false)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    color: 'var(--body)',
                    textDecoration: 'none',
                  }}
                >
                  {secondaryLabel}
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  )
}
