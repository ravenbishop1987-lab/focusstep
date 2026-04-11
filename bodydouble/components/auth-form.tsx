'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { APP_NAME } from '@/lib/constants'

export function AuthForm() {
  const supabase = createClient()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    const syncExistingSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session && !cancelled) {
        window.location.replace('/dashboard')
      }
    }

    void syncExistingSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && !cancelled) {
        window.location.replace('/dashboard')
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [supabase])

  async function settleSession() {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        return true
      }

      await new Promise((resolve) => window.setTimeout(resolve, 150))
    }

    return false
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      setMessage(error ? error.message : 'Check your email for the sign-in link and confirmation message.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setMessage(error.message)
      } else {
        setMessage('Opening your dashboard...')

        const hasSession = await settleSession()
        if (!hasSession) {
          setMessage('Your session is taking a moment to sync. Sending you to sign in again...')
        }

        window.location.assign('/dashboard')
        return
      }
    }

    setLoading(false)
  }

  async function handleGoogle() {
    setLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    setLoading(false)
  }

  return (
    <div className="page-shell flex items-center justify-center">
      <div className="w-full max-w-[430px]">
        <div className="mb-8 text-center">
          <p className="section-label mb-3">Quiet focus for ADHD brains</p>
          <h1 className="text-[34px] leading-tight">
            {APP_NAME} keeps a calm <span className="hero-emphasis">human presence</span> in the room.
          </h1>
          <p className="mt-3 text-[14px] text-ink-muted">
            Share your goal, meet a stranger, and work side by side for a gentle 25-minute sprint.
          </p>
        </div>

        <div className="card">
          <div className="mb-5 grid grid-cols-2 gap-2 rounded-[12px] bg-bg p-1">
            {(['login', 'signup'] as const).map((value) => (
              <button
                className={value === mode ? 'btn-primary w-full' : 'btn-ghost w-full rounded-[10px]'}
                key={value}
                onClick={() => {
                  setMode(value)
                  setMessage('')
                }}
                type="button"
              >
                {value === 'login' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {mode === 'signup' ? (
              <div>
                <label className="section-label mb-2 block">Name</label>
                <input
                  className="input"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="What should your partner call you?"
                  required
                  value={name}
                />
              </div>
            ) : null}

            <div>
              <label className="section-label mb-2 block">Email</label>
              <input
                className="input"
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                required
                type="email"
                value={email}
              />
            </div>

            <div>
              <label className="section-label mb-2 block">Password</label>
              <input
                className="input"
                minLength={8}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="At least 8 characters"
                required
                type="password"
                value={password}
              />
            </div>

            {message ? <div className="banner text-[13px]">{message}</div> : null}

            <button className="btn-primary w-full" disabled={loading} type="submit">
              {loading ? 'Getting your space ready...' : mode === 'login' ? 'Enter session space' : 'Create my account'}
            </button>
          </form>

          <div className="my-4 h-px bg-border" />

          <button className="btn-ghost w-full justify-center" onClick={handleGoogle} type="button">
            Continue with Google
          </button>

          <p className="mt-4 text-center text-[12px] text-ink-faint">
            Camera is always optional. Quiet accountability is the point.
          </p>
        </div>
      </div>
    </div>
  )
}
