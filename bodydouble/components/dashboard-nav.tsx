'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'
import { BrandLockup } from '@/components/brand-lockup'
import { getInitials } from '@/lib/utils'

type Props = {
  name: string | null
  plan: string
}

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/translate', label: 'Translate' },
  { href: '/match', label: 'Find partner' },
  { href: '/friends', label: 'Friends' },
  { href: '/schedule', label: 'Schedule' },
  { href: '/billing', label: 'Billing' },
]

const ACCOUNT_LINKS = [
  { href: '/translate', label: 'Task Translator' },
  { href: '/match', label: 'Find a partner' },
  { href: '/profile', label: 'Profile & settings' },
  { href: '/friends', label: 'Friends' },
  { href: '/billing', label: 'Membership & billing' },
  { href: '/schedule', label: 'Schedule a session' },
]

export function DashboardNav({ name, plan }: Props) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const accountRef = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as Node

      if (accountRef.current && !accountRef.current.contains(target)) {
        setAccountOpen(false)
      }

      if (mobileRef.current && !mobileRef.current.contains(target)) {
        setMobileNavOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const initials = getInitials(name)
  const isPaid = plan === 'pro' || plan === 'lifetime'

  return (
    <nav
      style={{
        background: 'var(--card)',
        borderBottom: '0.5px solid var(--bdc)',
        padding: '0 16px',
        minHeight: 56,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        gap: 12,
      }}
      className="md:px-6"
    >
      <div className="flex items-center gap-3" ref={mobileRef}>
        <button
          className="md:hidden"
          onClick={() => setMobileNavOpen((value) => !value)}
          type="button"
          aria-label="Open menu"
          style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            border: '0.5px solid var(--bdc)',
            background: 'var(--card)',
            color: 'var(--ink)',
            fontSize: 18,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          {mobileNavOpen ? '×' : '☰'}
        </button>

        <Link
          href="/dashboard"
          style={{
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          <BrandLockup compact />
        </Link>

        {mobileNavOpen ? (
          <div
            className="md:hidden"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 16,
              right: 16,
              background: 'var(--card)',
              border: '0.5px solid var(--bdc)',
              borderRadius: 14,
              padding: 10,
              boxShadow: '0 18px 42px rgba(44, 42, 34, 0.1)',
              zIndex: 120,
            }}
          >
            <div className="grid gap-2">
              {NAV_LINKS.map((item) => (
                <Link
                  href={item.href}
                  key={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    color: 'var(--body)',
                    textDecoration: 'none',
                    fontSize: 14,
                  }}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        style={{
          gap: 24,
          fontSize: 13,
          color: 'var(--muted)',
        }}
        className="hidden md:flex"
      >
        {NAV_LINKS.map((item) => (
          <Link href={item.href} key={item.href} style={{ color: 'var(--muted)' }}>
            {item.label}
          </Link>
        ))}
      </div>

      <div ref={accountRef} style={{ position: 'relative' }}>
        <button
          onClick={() => setAccountOpen((value) => !value)}
          type="button"
          aria-label="Open account menu"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'transparent',
            border: '0.5px solid var(--bdc)',
            borderRadius: 40,
            padding: '5px 10px 5px 6px',
            cursor: 'pointer',
            minHeight: 38,
            maxWidth: 'min(68vw, 280px)',
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: 'var(--chip)',
              border: '0.5px solid var(--accent-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 11,
              fontWeight: 600,
              color: 'var(--accent-dark)',
              flexShrink: 0,
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {initials}
          </div>

          <span
            className="hidden sm:inline"
            style={{
              fontSize: 13,
              color: 'var(--ink)',
              fontWeight: 500,
              maxWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {name ?? 'Account'}
          </span>

          {isPaid ? (
            <span className="pro-badge hidden sm:inline-flex" style={{ marginLeft: 2 }}>
              {plan === 'lifetime' ? 'Lifetime' : 'Pro'}
            </span>
          ) : null}

          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
            style={{
              color: 'var(--muted)',
              transform: accountOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              flexShrink: 0,
            }}
          >
            <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        {accountOpen ? (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 220,
              maxWidth: 'calc(100vw - 32px)',
              background: 'var(--card)',
              border: '0.5px solid var(--bdc)',
              borderRadius: 12,
              overflow: 'hidden',
              zIndex: 100,
            }}
          >
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '0.5px solid var(--bdc)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: 'var(--chip)',
                    border: '0.5px solid var(--accent-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13,
                    fontWeight: 600,
                    color: 'var(--accent-dark)',
                    flexShrink: 0,
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name ?? 'Account'}
                  </p>
                  <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 1, textTransform: 'capitalize' }}>
                    {plan} plan
                  </p>
                </div>
              </div>
            </div>

            {ACCOUNT_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setAccountOpen(false)}
                style={{
                  display: 'block',
                  padding: '10px 16px',
                  fontSize: 13,
                  color: 'var(--body)',
                  textDecoration: 'none',
                  borderBottom: '0.5px solid var(--bdc)',
                }}
              >
                {item.label}
              </Link>
            ))}

            <SignOutButton
              className=""
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 16px',
                fontSize: 13,
                color: 'var(--muted)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            />
          </div>
        ) : null}
      </div>
    </nav>
  )
}
