'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getInitials } from '@/lib/utils'

type FriendRow = {
  rowId: string
  id: string
  name: string | null
  email: string
  focus_types: string[] | null
}

type FriendsData = {
  friends: FriendRow[]
  pending: FriendRow[]
  sent: FriendRow[]
  activeSessions: Array<{
    roomId: string
    roomUrl: string | null
    partnerId: string | null
    partnerName: string
    partnerEmail: string
    matchedAt: string | null
    goal: string
  }>
}

function Avatar({ name, size = 44 }: { name: string | null; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: 'var(--chip)',
        border: '0.5px solid var(--accent-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.27,
        fontWeight: 700,
        color: 'var(--accent-dark)',
        flexShrink: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {getInitials(name)}
    </div>
  )
}

export function FriendsClient({ userId: _userId }: { userId: string }) {
  const router = useRouter()
  void _userId
  const [data, setData] = useState<FriendsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [addMsg, setAddMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [addLoading, setAddLoading] = useState(false)
  const [sessionGoal, setSessionGoal] = useState('')
  const [sessionFriend, setSessionFriend] = useState<FriendRow | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)
  const [sessionError, setSessionError] = useState('')
  const [sessionInvite, setSessionInvite] = useState<{
    friendName: string
    roomId: string
    roomUrl: string
    sessionUrl: string
  } | null>(null)
  const [inviteCopied, setInviteCopied] = useState(false)
  const [incomingInvite, setIncomingInvite] = useState<FriendsData['activeSessions'][number] | null>(null)
  const [dismissedInviteIds, setDismissedInviteIds] = useState<string[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/friends')
    const json = await res.json()
    setData(json)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
    const interval = setInterval(() => {
      void load()
    }, 10000)

    return () => clearInterval(interval)
  }, [load])

  useEffect(() => {
    const nextInvite = data?.activeSessions?.find((session) => !dismissedInviteIds.includes(session.roomId))
    if (!nextInvite) return
    setIncomingInvite((current) => current ?? nextInvite)
  }, [data, dismissedInviteIds])

  async function sendRequest(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setAddLoading(true)
    setAddMsg(null)
    const res = await fetch('/api/friends', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    })
    const json = await res.json()
    setAddMsg({ text: res.ok ? `Request sent to ${json.name ?? email}!` : json.error, ok: res.ok })
    if (res.ok) { setEmail(''); load() }
    setAddLoading(false)
  }

  async function respond(rowId: string, action: 'accept' | 'decline') {
    setActionLoading(rowId + action)
    await fetch('/api/friends/respond', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId, action }),
    })
    await load()
    setActionLoading(null)
  }

  async function remove(rowId: string) {
    setActionLoading(rowId + 'remove')
    await fetch('/api/friends', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rowId }),
    })
    await load()
    setActionLoading(null)
  }

  async function startSession() {
    if (!sessionFriend) return
    setSessionLoading(true)
    setSessionError('')
    const res = await fetch('/api/friends/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendId: sessionFriend.id, goal: sessionGoal }),
    })
    const json = await res.json()
    if (res.ok) {
      const sessionUrl =
        typeof window === 'undefined'
          ? `/session/${json.roomId}`
          : new URL(`/session/${json.roomId}`, window.location.origin).toString()

      setSessionInvite({
        friendName: sessionFriend.name ?? sessionFriend.email,
        roomId: json.roomId,
        roomUrl: json.roomUrl ?? '',
        sessionUrl,
      })
      setInviteCopied(false)
      setSessionFriend(null)
      setSessionGoal('')
      setSessionLoading(false)
    } else {
      setSessionError(json.error ?? 'Could not start session.')
      setSessionLoading(false)
    }
  }

  async function copyInviteLink() {
    if (!sessionInvite) return
    const preferredLink = sessionInvite.roomUrl || sessionInvite.sessionUrl
    try {
      await navigator.clipboard.writeText(preferredLink)
      setInviteCopied(true)
    } catch {
      setInviteCopied(false)
    }
  }

  const pendingCount = data?.pending.length ?? 0

  const isMockInvite = Boolean(sessionInvite?.roomUrl?.startsWith('mock://'))
  const preferredInviteLink = sessionInvite ? (sessionInvite.roomUrl && !isMockInvite ? sessionInvite.roomUrl : sessionInvite.sessionUrl) : ''

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-[960px]">

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <p className="section-label" style={{ marginBottom: 6 }}>Social</p>
          <h1 style={{ fontFamily: 'Georgia, serif', fontSize: 32, fontWeight: 700, color: 'var(--ink)', margin: 0 }}>
            Friends
          </h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 6 }}>
            Add people you know and start a focus session together any time.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">

          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Pending incoming requests */}
            {pendingCount > 0 && (
              <div className="card" style={{ border: '1.5px solid var(--accent-border)' }}>
                <p className="section-label" style={{ marginBottom: 14 }}>
                  Friend requests — {pendingCount}
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data!.pending.map((p) => (
                    <div
                      key={p.rowId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        background: 'var(--subtle)',
                        border: '0.5px solid var(--accent-light)',
                        borderRadius: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <Avatar name={p.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>{p.name ?? 'Someone'}</p>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{p.email}</p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, width: '100%', justifyContent: 'flex-end' }} className="sm:w-auto">
                        <button
                          className="btn-primary"
                          disabled={actionLoading === p.rowId + 'accept'}
                          onClick={() => respond(p.rowId, 'accept')}
                          style={{ padding: '7px 16px', fontSize: 12, minHeight: 36 }}
                          type="button"
                        >
                          {actionLoading === p.rowId + 'accept' ? '…' : 'Accept'}
                        </button>
                        <button
                          className="btn-ghost"
                          disabled={actionLoading === p.rowId + 'decline'}
                          onClick={() => respond(p.rowId, 'decline')}
                          style={{ padding: '7px 14px', fontSize: 12, minHeight: 36 }}
                          type="button"
                        >
                          {actionLoading === p.rowId + 'decline' ? '…' : 'Decline'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Friends list */}
            <div className="card">
              <p className="section-label" style={{ marginBottom: 14 }}>
                Your friends {data ? `— ${data.friends.length}` : ''}
              </p>

              {loading && (
                <p style={{ fontSize: 13, color: 'var(--faint)', padding: '12px 0' }}>Loading…</p>
              )}

              {!loading && data?.friends.length === 0 && (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '32px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div style={{ fontSize: 28 }}>○</div>
                  <p style={{ fontSize: 14, color: 'var(--muted)' }}>No friends yet.</p>
                  <p style={{ fontSize: 13, color: 'var(--faint)' }}>Add someone by email to get started.</p>
                </div>
              )}

              {!loading && data && data.friends.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {data.friends.map((f) => (
                    <div
                      key={f.rowId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        borderRadius: 10,
                        transition: 'background 0.1s',
                        flexWrap: 'wrap',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Avatar name={f.name} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {f.name ?? 'Friend'}
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 1 }}>{f.email}</p>
                        {f.focus_types?.length ? (
                          <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 3 }}>
                            {f.focus_types.slice(0, 3).join(' · ')}
                          </p>
                        ) : null}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0, width: '100%' }} className="sm:w-auto">
                        <button
                          className="btn-primary"
                          onClick={() => { setSessionFriend(f); setSessionGoal(''); setSessionError('') }}
                          style={{ padding: '7px 14px', fontSize: 12, minHeight: 36, display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}
                          type="button"
                        >
                          ▶ Focus together
                        </button>
                        <button
                          className="btn-ghost"
                          disabled={actionLoading === f.rowId + 'remove'}
                          onClick={() => remove(f.rowId)}
                          style={{ padding: '7px 12px', fontSize: 12, minHeight: 36 }}
                          title="Remove friend"
                          type="button"
                        >
                          {actionLoading === f.rowId + 'remove' ? '…' : '×'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {data && data.activeSessions.length > 0 && (
              <div className="card" style={{ border: '1.5px solid var(--accent-border)' }}>
                <p className="section-label" style={{ marginBottom: 14 }}>Ready to join</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {data.activeSessions.map((session) => (
                    <div
                      key={session.roomId}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'var(--subtle)',
                        border: '0.5px solid var(--accent-light)',
                        borderRadius: 10,
                        flexWrap: 'wrap',
                      }}
                    >
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                          {session.partnerName} started a focus room
                        </p>
                        <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
                          {session.goal ? `Goal: ${session.goal}` : 'Private focus session ready'}
                        </p>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <button
                          className="btn-primary"
                          onClick={() => router.push(`/session/${session.roomId}`)}
                          style={{ padding: '7px 14px', fontSize: 12, minHeight: 36 }}
                          type="button"
                        >
                          Join in app
                        </button>
                        {session.roomUrl && !session.roomUrl.startsWith('mock://') ? (
                          <a
                            className="btn-ghost inline-flex items-center justify-center"
                            href={session.roomUrl}
                            rel="noreferrer"
                            style={{ padding: '7px 14px', fontSize: 12, minHeight: 36 }}
                            target="_blank"
                          >
                            Open Daily
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sent requests */}
            {data && data.sent.length > 0 && (
              <div className="card">
                <p className="section-label" style={{ marginBottom: 14 }}>Sent requests — {data.sent.length}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {data.sent.map((s) => (
                    <div
                      key={s.rowId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '8px 0',
                        borderBottom: '0.5px solid var(--bdc)',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Avatar name={s.name} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{s.name ?? 'Pending'}</p>
                        <p style={{ fontSize: 12, color: 'var(--muted)' }}>{s.email}</p>
                      </div>
                      <span
                        style={{
                          fontSize: 11,
                          color: 'var(--faint)',
                          background: 'var(--bg)',
                          border: '0.5px solid var(--bdc)',
                          borderRadius: 20,
                          padding: '2px 10px',
                        }}
                      >
                        Pending
                      </span>
                      <button
                        className="btn-ghost"
                        disabled={actionLoading === s.rowId + 'remove'}
                        onClick={() => remove(s.rowId)}
                        style={{ padding: '4px 10px', fontSize: 11, minHeight: 30 }}
                        title="Cancel request"
                        type="button"
                      >
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Add friend */}
            <div className="card">
              <p className="section-label" style={{ marginBottom: 4 }}>Add a friend</p>
              <p style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 14, lineHeight: 1.5 }}>
                Enter their email address. They&apos;ll receive a friend request.
              </p>
              <form onSubmit={sendRequest} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <input
                  className="input"
                  disabled={addLoading}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="friend@example.com"
                  required
                  type="email"
                  value={email}
                />
                {addMsg && (
                  <div
                    style={{
                      fontSize: 12,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: addMsg.ok ? 'var(--subtle)' : 'var(--bg)',
                      border: `0.5px solid ${addMsg.ok ? 'var(--accent-light)' : 'var(--bdc)'}`,
                      color: addMsg.ok ? 'var(--accent-dark)' : 'var(--muted)',
                    }}
                  >
                    {addMsg.text}
                  </div>
                )}
                <button
                  className="btn-primary w-full"
                  disabled={addLoading}
                  style={{ fontSize: 13 }}
                  type="submit"
                >
                  {addLoading ? 'Sending…' : 'Send friend request'}
                </button>
              </form>
            </div>

            {/* Start session modal-style panel */}
            {sessionFriend ? (
              <div
                className="card"
                style={{ border: '1.5px solid var(--accent-border)' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <p className="section-label">Start session with</p>
                  <button
                    type="button"
                    onClick={() => setSessionFriend(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: 16,
                      color: 'var(--faint)',
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  <Avatar name={sessionFriend.name} size={36} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>
                      {sessionFriend.name ?? 'Friend'}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--muted)' }}>{sessionFriend.email}</p>
                  </div>
                </div>

                <label className="section-label" style={{ display: 'block', marginBottom: 6 }}>
                  What are you working on?
                </label>
                <textarea
                  className="input"
                  onChange={(e) => setSessionGoal(e.target.value)}
                  placeholder="Your goal for this session…"
                  rows={3}
                  style={{ marginBottom: 10 }}
                  value={sessionGoal}
                />

                {sessionError && (
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 10 }}>{sessionError}</p>
                )}

                <p style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 12, lineHeight: 1.5 }}>
                  A Daily room will be created. Your friend will see a notification to join.
                </p>

                <button
                  className="btn-primary w-full"
                  disabled={sessionLoading}
                  onClick={startSession}
                  style={{ fontSize: 13 }}
                  type="button"
                >
                  {sessionLoading ? 'Creating room…' : '▶ Start focus session'}
                </button>
              </div>
            ) : (
              <div
                className="card"
                style={{
                  background: 'var(--subtle)',
                  border: '0.5px solid var(--accent-light)',
                }}
              >
                <p style={{ fontSize: 13, color: 'var(--accent-dark)', lineHeight: 1.6 }}>
                  Click <strong>Focus together</strong> next to any friend to create a private session room just for the two of you.
                </p>
              </div>
            )}

            {/* How it works */}
            <div className="card">
              <p className="section-label" style={{ marginBottom: 10 }}>How friend sessions work</p>
              {[
                { n: '1', t: 'Click "Focus together"', b: 'Choose a friend and write your goal.' },
                { n: '2', t: 'A room is created', b: 'A private Daily room is created for both of you.' },
                { n: '3', t: 'Share the link', b: 'Send your friend the session URL so they can join.' },
              ].map((step) => (
                <div key={step.n} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'var(--accent)',
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      fontFamily: 'system-ui',
                    }}
                  >
                    {step.n}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{step.t}</p>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{step.b}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {sessionInvite ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(18, 16, 14, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 60,
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: 520,
                border: '1.5px solid var(--accent-border)',
                boxShadow: '0 24px 80px rgba(33, 24, 17, 0.18)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                <div>
                  <p className="section-label" style={{ marginBottom: 6 }}>Private session ready</p>
                  <h2 style={{ fontSize: 24, lineHeight: 1.2, color: 'var(--ink)', margin: 0 }}>
                    Send this link to {sessionInvite.friendName}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSessionInvite(null)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 18,
                    color: 'var(--faint)',
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>

              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
                {sessionInvite.roomUrl && !isMockInvite
                  ? 'Your Daily room is live. Send the direct Daily link to your friend so they can join right away.'
                  : 'Your room is live. Copy the session link below and send it to your friend so they can join you.'}
              </p>

              <div className="banner" style={{ marginTop: 16 }}>
                <p className="section-label" style={{ marginBottom: 8 }}>
                  {sessionInvite.roomUrl && !isMockInvite ? 'Daily join link' : 'Join session link'}
                </p>
                <div
                  style={{
                    wordBreak: 'break-all',
                    fontSize: 13,
                    color: 'var(--ink)',
                    background: 'rgba(255,255,255,0.55)',
                    borderRadius: 8,
                    padding: '10px 12px',
                  }}
                >
                  {preferredInviteLink}
                </div>
              </div>

              {sessionInvite.roomUrl && !isMockInvite ? (
                <div className="banner" style={{ marginTop: 12 }}>
                  <p className="section-label" style={{ marginBottom: 8 }}>In-app backup link</p>
                  <div
                    style={{
                      wordBreak: 'break-all',
                      fontSize: 13,
                      color: 'var(--ink)',
                      background: 'rgba(255,255,255,0.55)',
                      borderRadius: 8,
                      padding: '10px 12px',
                    }}
                  >
                    {sessionInvite.sessionUrl}
                  </div>
                </div>
              ) : null}

              {inviteCopied ? (
                <div className="banner" style={{ marginTop: 12, fontSize: 12 }}>
                  Invite link copied. Send it to your friend, then join when you’re ready.
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
                <button className="btn-primary" onClick={copyInviteLink} type="button">
                  Copy invite link
                </button>
                {sessionInvite.roomUrl && !isMockInvite ? (
                  <a
                    className="btn-ghost inline-flex items-center justify-center"
                    href={sessionInvite.roomUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open Daily room
                  </a>
                ) : null}
                <button className="btn-ghost" onClick={() => router.push(`/session/${sessionInvite.roomId}`)} type="button">
                  Join session now
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {incomingInvite ? (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(18, 16, 14, 0.45)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
              zIndex: 61,
            }}
          >
            <div
              className="card"
              style={{
                width: '100%',
                maxWidth: 500,
                border: '1.5px solid var(--accent-border)',
                boxShadow: '0 24px 80px rgba(33, 24, 17, 0.18)',
              }}
            >
              <p className="section-label" style={{ marginBottom: 8 }}>Focus invite</p>
              <h2 style={{ fontSize: 24, lineHeight: 1.2, color: 'var(--ink)', margin: 0 }}>
                {incomingInvite.partnerName} invited you to focus together
              </h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
                {incomingInvite.goal ? `Goal: ${incomingInvite.goal}` : 'Your private session room is ready.'}
              </p>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18 }}>
                <button className="btn-primary" onClick={() => router.push(`/session/${incomingInvite.roomId}`)} type="button">
                  Join session
                </button>
                {incomingInvite.roomUrl && !incomingInvite.roomUrl.startsWith('mock://') ? (
                  <a
                    className="btn-ghost inline-flex items-center justify-center"
                    href={incomingInvite.roomUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open Daily
                  </a>
                ) : null}
                <button
                  className="btn-ghost"
                  onClick={() => {
                    setDismissedInviteIds((current) => [...current, incomingInvite.roomId])
                    setIncomingInvite(null)
                  }}
                  type="button"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
