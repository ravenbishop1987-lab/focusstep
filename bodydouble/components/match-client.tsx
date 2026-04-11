'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LIVE_MATCH_DURATION_MINUTES, QUICK_GOALS } from '@/lib/constants'
import { cn } from '@/lib/utils'

type MatchClientProps = {
  userId: string
  existingGoal: string
}

export function MatchClient({ userId, existingGoal }: MatchClientProps) {
  const [supabase] = useState(() => createClient())
  const router = useRouter()
  const [goal, setGoal] = useState(existingGoal)
  const [onlineCount, setOnlineCount] = useState(1)
  const [searching, setSearching] = useState(false)
  const [banner, setBanner] = useState('')
  const [statusText, setStatusText] = useState('Ready when you are.')
  const [matchedRoomId, setMatchedRoomId] = useState<string | null>(null)
  const [redirecting, setRedirecting] = useState(false)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const redirectRef = useRef<NodeJS.Timeout | null>(null)

  const selectedQuickGoal = useMemo(
    () => QUICK_GOALS.find((item) => item.toLowerCase() === goal.toLowerCase()),
    [goal]
  )

  useEffect(() => {
    const channel = supabase.channel('match-presence', {
      config: {
        presence: { key: userId },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const presence = channel.presenceState()
        const count = Object.keys(presence).length
        setOnlineCount(Math.max(1, count))
      })
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'queue',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const next = payload.new as { room_id?: string; status?: string }
          if (next.status === 'matched' && next.room_id) {
            if (intervalRef.current) clearInterval(intervalRef.current)
            if (timeoutRef.current) clearTimeout(timeoutRef.current)
            setSearching(false)
            setMatchedRoomId(next.room_id)
          }
        }
      )
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ onlineAt: new Date().toISOString() })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [router, supabase, userId])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (redirectRef.current) clearTimeout(redirectRef.current)
    }
  }, [])

  useEffect(() => {
    if (!matchedRoomId) {
      setRedirecting(false)
      if (redirectRef.current) {
        clearTimeout(redirectRef.current)
        redirectRef.current = null
      }
      return
    }

    setRedirecting(true)
    setStatusText('Partner found. Opening your focus room now.')

    redirectRef.current = setTimeout(() => {
      router.push(`/session/${matchedRoomId}`)
      router.refresh()
    }, 900)

    return () => {
      if (redirectRef.current) {
        clearTimeout(redirectRef.current)
        redirectRef.current = null
      }
    }
  }, [matchedRoomId, router])

  async function pollForMatch() {
    const response = await fetch('/api/match')
    const data = await response.json().catch(() => ({}))

    if (!response.ok) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      setSearching(false)
      setBanner(data.error ?? 'Matching hit a server error. Please try again in a moment.')
      setStatusText('We hit a hiccup while checking the queue.')
      return
    }

    if (data.roomId) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
      setSearching(false)
      setMatchedRoomId(data.roomId)
      return
    }

    if (data.status === 'matching') {
      setStatusText('We found someone and are opening the room now.')
      return
    }

    if (data.status === 'waiting') {
      setStatusText('Looking for someone who is ready for a quiet sprint.')
    }
  }

  async function handleJoinQueue() {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setSearching(true)
    setBanner('')
    setStatusText('Joining the matching space...')

    const response = await fetch('/api/match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal }),
    })

    const data = await response.json()

    if (!response.ok) {
      setSearching(false)
      setBanner(data.error ?? 'Something gentle but unexpected happened.')
      setStatusText('We could not join the queue yet.')
      return
    }

    if (data.roomId) {
      setSearching(false)
      setMatchedRoomId(data.roomId)
      setStatusText('Partner found. Opening your focus room now.')
      return
    }

    setStatusText('You are in line. We are checking every few seconds for a match.')

    intervalRef.current = setInterval(() => {
      void pollForMatch()
    }, 3000)

    timeoutRef.current = setTimeout(() => {
      setBanner('No one available right now. You can keep this goal here and schedule a session instead.')
    }, 90000)

    void pollForMatch()
  }

  return (
    <div className="page-shell flex items-center justify-center">
      {matchedRoomId ? (
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
              maxWidth: 480,
              border: '1.5px solid var(--accent-border)',
              boxShadow: '0 24px 80px rgba(33, 24, 17, 0.18)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--chip)',
                border: '1.5px solid var(--accent-border)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 24,
                margin: '0 auto 16px',
              }}
            >
              ▶
            </div>
            <p className="section-label" style={{ marginBottom: 6 }}>Partner found</p>
            <h2 style={{ fontSize: 24, lineHeight: 1.2, color: 'var(--ink)', margin: 0 }}>
              Your focus room is ready
            </h2>
            <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 10, lineHeight: 1.6 }}>
              {redirecting
                ? 'A Daily room has been opened for this session. We are taking you there now.'
                : 'A Daily room has been opened for this session. Join when you are ready.'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap', marginTop: 20 }}>
              <button
                className="btn-primary"
                onClick={() => {
                  if (redirectRef.current) {
                    clearTimeout(redirectRef.current)
                    redirectRef.current = null
                  }
                  router.push(`/session/${matchedRoomId}`)
                  router.refresh()
                }}
                type="button"
              >
                {redirecting ? 'Open room now' : 'Join session now'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  if (redirectRef.current) {
                    clearTimeout(redirectRef.current)
                    redirectRef.current = null
                  }
                  setMatchedRoomId(null)
                  setStatusText('Ready when you are.')
                }}
                type="button"
              >
                Not now
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="card w-full max-w-[720px] px-4 py-5 text-center sm:px-6">
        <p className="section-label mb-3">Live matching</p>
        <div className="mx-auto mb-5 flex h-[96px] w-[96px] items-center justify-center rounded-full border border-accent-border bg-card sm:h-[120px] sm:w-[120px]">
          <div
            className={cn(
              'flex h-[68px] w-[68px] items-center justify-center rounded-full border bg-chip text-[12px] text-accent-dark sm:h-[84px] sm:w-[84px]',
              searching && 'animate-[pulse-ring_1.8s_ease-in-out_infinite]'
            )}
          >
            Focus
          </div>
        </div>

        <h1 className="text-[28px] leading-tight sm:text-[32px]">Find a calm stranger to work beside.</h1>
        <p className="mx-auto mt-3 max-w-[500px] text-[14px] text-ink-muted">{statusText}</p>

        <div className="mx-auto mt-7 max-w-[560px] text-left">
          <label className="section-label mb-2 block">What are you working on?</label>
          <textarea
            className="input min-h-[120px]"
            onChange={(event) => setGoal(event.target.value)}
            placeholder="Write a short goal. Camera is optional, presence is enough."
            value={goal}
          />
          <div className="mt-3 flex flex-wrap gap-3">
            {QUICK_GOALS.map((item) => (
              <button
                className={cn('chip', selectedQuickGoal === item && 'chip-selected')}
                key={item}
                onClick={() => setGoal(item)}
                type="button"
              >
                {item}
              </button>
            ))}
          </div>

          <div className="banner mt-5 text-left text-[13px]">
            Random matching runs in calm {LIVE_MATCH_DURATION_MINUTES}-minute focus sprints. When one sprint ends, you can hop right into a fresh match with a new timer.
          </div>
        </div>

        <p className="mt-5 text-[13px] text-ink-muted">{onlineCount} people online now</p>

        {banner ? <div className="banner mx-auto mt-5 max-w-[560px] text-left text-[13px]">{banner}</div> : null}

        <div className="mt-7">
          <button className="btn-primary w-full sm:min-w-[220px] sm:w-auto" disabled={searching} onClick={handleJoinQueue} type="button">
            {searching ? 'Searching quietly...' : 'Find a partner now'}
          </button>
        </div>
      </div>
    </div>
  )
}
