'use client'

import { useState } from 'react'

export function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Plug in Resend audience / Mailchimp here when ready
    setDone(true)
  }

  if (done) {
    return (
      <p style={{ fontSize: 14, color: 'var(--accent-light)', fontWeight: 500 }}>
        You&rsquo;re in. Talk soon. 🌱
      </p>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}
    >
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        style={{
          background: 'rgba(255,255,255,0.12)',
          border: '0.5px solid rgba(255,255,255,0.25)',
          borderRadius: 8,
          padding: '10px 16px',
          fontSize: 14,
          color: '#fff',
          outline: 'none',
          minHeight: 44,
          width: 240,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      />
      <button
        type="submit"
        style={{
          background: 'var(--accent-light)',
          color: 'var(--accent-dark)',
          border: 'none',
          borderRadius: 8,
          padding: '10px 22px',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: 44,
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        Subscribe →
      </button>
    </form>
  )
}
