'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getInitials } from '@/lib/utils'

type Friend = {
  rowId: string
  id: string
  name: string | null
  email: string
}

export function FriendsSidebarWidget() {
  const router = useRouter()
  const [friends, setFriends] = useState<Friend[]>([])
  const [pending, setPending] = useState(0)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/friends')
      .then((r) => r.json())
      .then((data) => {
        setFriends(data.friends ?? [])
        setPending(data.pending?.length ?? 0)
      })
      .finally(() => setLoading(false))
  }, [])

  async function quickStart(friend: Friend) {
    setStarting(friend.id)
    const res = await fetch('/api/friends/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId: friend.id, goal: '' }),
    })
    const data = await res.json()
    if (res.ok) {
      router.push(`/session/${data.roomId}`)
    } else {
      setStarting(null)
      alert(data.error ?? 'Could not start session.')
    }
  }

  if (!loading && friends.length === 0 && pending === 0) {
    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p className="section-label">Friends</p>
          <Link href="/friends" style={{ fontSize: 12, color: 'var(--accent)', textDecoration: 'underline' }}>
            Add friends →
          </Link>
        </div>
        <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
          Add friends to start private focus sessions together.
        </p>
      </div>
    )
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <p className="section-label">Friends</p>
          {pending > 0 && (
            <span
              style={{
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 20,
                fontSize: 10,
                fontWeight: 700,
                padding: '1px 7px',
                fontFamily: 'system-ui',
              }}
            >
              {pending}
            </span>
          )}
        </div>
        <Link href="/friends" style={{ fontSize: 12, color: 'var(--muted)' }}>
          View all →
        </Link>
      </div>

      {pending > 0 && (
        <Link
          href="/friends"
          style={{
            display: 'block',
            marginBottom: 10,
            padding: '8px 12px',
            background: 'var(--subtle)',
            border: '0.5px solid var(--accent-light)',
            borderRadius: 8,
            fontSize: 12,
            color: 'var(--accent-dark)',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          {pending} friend request{pending > 1 ? 's' : ''} waiting →
        </Link>
      )}

      {loading && (
        <p style={{ fontSize: 12, color: 'var(--faint)', padding: '4px 0' }}>Loading…</p>
      )}

      {!loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {friends.slice(0, 4).map((f) => (
            <div
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--chip)',
                  border: '0.5px solid var(--accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: 'var(--accent-dark)',
                  flexShrink: 0,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {getInitials(f.name)}
              </div>

              {/* Name */}
              <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {f.name ?? f.email}
              </p>

              {/* Quick focus button */}
              <button
                type="button"
                disabled={starting === f.id}
                onClick={() => quickStart(f)}
                title={`Focus with ${f.name ?? f.email}`}
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: starting === f.id ? 'wait' : 'pointer',
                  flexShrink: 0,
                  minHeight: 28,
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  opacity: starting === f.id ? 0.7 : 1,
                }}
              >
                {starting === f.id ? '…' : '▶ Focus'}
              </button>
            </div>
          ))}

          {friends.length > 4 && (
            <Link
              href="/friends"
              style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}
            >
              +{friends.length - 4} more friends →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
