'use client'

import { useState } from 'react'

export function CheckoutButton({
  priceId,
  planKey,
  mode,
  label,
  disabled = false,
}: {
  priceId: string
  planKey: 'pro' | 'lifetime'
  mode: 'payment' | 'subscription'
  label: string
  disabled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCheckout() {
    if (disabled || loading) return
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, planKey, mode }),
      })

      const data = await response.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Could not start Stripe checkout.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        className="btn-primary w-full"
        disabled={disabled || loading}
        onClick={handleCheckout}
        type="button"
      >
        {loading ? 'Redirecting to Stripe...' : label}
      </button>
      {error ? (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function PortalButton({ label = 'Manage billing' }: { label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handlePortal() {
    if (loading) return
    setLoading(true)
    setError('')

    try {
      const response = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error ?? 'Could not open billing portal.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        className="btn-ghost w-full"
        disabled={loading}
        onClick={handlePortal}
        type="button"
      >
        {loading ? 'Opening portal...' : label}
      </button>
      {error ? (
        <p className="mt-2 text-[12px]" style={{ color: 'var(--muted)' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
