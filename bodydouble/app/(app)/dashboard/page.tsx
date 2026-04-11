import Link from 'next/link'
import { getDashboardData, requireOnboardedProfile } from '@/lib/data'
import { formatGreeting, formatMinutes, getInitials } from '@/lib/utils'
import { FREE_WEEKLY_SESSION_LIMIT } from '@/lib/constants'
import { SessionCalendar } from '@/components/session-calendar'
import { FriendsSidebarWidget } from '@/components/friends-sidebar-widget'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const profile = await requireOnboardedProfile()
  const data = await getDashboardData(profile.id)
  const initialTodayIso = new Date().toISOString()

  const isPaid = profile.plan === 'pro' || profile.plan === 'lifetime'
  const sessionLimitReached =
    !isPaid && data.weeklySessions >= FREE_WEEKLY_SESSION_LIMIT

  // Task Translator stats
  const supabase = createClient()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const [{ count: translationsToday }, { count: totalTasks }] = await Promise.all([
    supabase
      .from('user_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .gte('created_at', today.toISOString()),
    supabase
      .from('user_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id),
  ])

  return (
    <div className="page-shell">
        <div className="mx-auto max-w-[1120px]">

          {/* ── Header ────────────────────────────────────────────── */}
          <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="section-label mb-2">Dashboard</p>
              <h1 className="text-[34px] leading-tight">
                {formatGreeting()},{' '}
                <span style={{ color: 'var(--accent)', fontStyle: 'italic' }}>
                  {profile.name}
                </span>
              </h1>
              <p className="mt-2 text-[14px]" style={{ color: 'var(--muted)' }}>
                A little shared presence can make the next task feel easier.
              </p>
            </div>
            <Link
              href="/profile"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: 'var(--card)',
                border: '0.5px solid var(--bdc)',
                borderRadius: 40,
                padding: '6px 14px 6px 8px',
                textDecoration: 'none',
                minHeight: 40,
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
                  fontWeight: 700,
                  color: 'var(--accent-dark)',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                }}
              >
                {getInitials(profile.name)}
              </div>
              <span style={{ fontSize: 13, color: 'var(--body)', fontWeight: 500 }}>
                Profile
              </span>
            </Link>
          </div>

          {/* ── Product cards ─────────────────────────────────────── */}
          <div className="mb-6 grid gap-4 md:grid-cols-2">
            {/* Task Translator */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p className="section-label mb-1">Task Translator</p>
                <p style={{ fontSize: 22, fontFamily: 'Georgia, serif', color: 'var(--ink)', marginBottom: 6 }}>
                  {translationsToday ?? 0}
                  {!isPaid && (
                    <span style={{ fontSize: 13, color: 'var(--faint)', fontFamily: 'system-ui', fontWeight: 400 }}>
                      {' '}/ 3 today
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {totalTasks ?? 0} total tasks translated. Turn anything overwhelming into calm, concrete steps.
                </p>
              </div>
              <Link href="/translate" className="btn-ghost inline-flex w-full items-center justify-center text-[13px]">
                Translate a task →
              </Link>
            </div>

            {/* Body Double */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 16 }}>
              <div>
                <p className="section-label mb-1">Body Double</p>
                <p style={{ fontSize: 22, fontFamily: 'Georgia, serif', color: 'var(--ink)', marginBottom: 6 }}>
                  {data.weeklySessions}
                  {!isPaid && (
                    <span style={{ fontSize: 13, color: 'var(--faint)', fontFamily: 'system-ui', fontWeight: 400 }}>
                      {' '}/ {FREE_WEEKLY_SESSION_LIMIT} this week
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {isPaid
                    ? 'Find an accountability partner for a live 25-minute focus session.'
                    : 'Upgrade to Pro to unlock live accountability sessions.'}
                </p>
              </div>
              {isPaid ? (
                <Link href="/match" className="btn-primary inline-flex w-full items-center justify-center text-[13px]">
                  Find a partner →
                </Link>
              ) : (
                <Link href="/billing" className="btn-ghost inline-flex w-full items-center justify-center text-[13px]">
                  Unlock Body Double →
                </Link>
              )}
            </div>
          </div>

          {/* ── Stat cards ────────────────────────────────────────── */}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="card">
              <p className="section-label">Sessions this week</p>
              <p className="mt-3 font-serif text-[22px] text-ink">
                {data.weeklySessions}
                {!isPaid && (
                  <span style={{ fontSize: 13, color: 'var(--faint)', fontFamily: 'system-ui', fontWeight: 400 }}>
                    {' '}/ {FREE_WEEKLY_SESSION_LIMIT}
                  </span>
                )}
              </p>
              {sessionLimitReached && (
                <p style={{ fontSize: 12, color: 'var(--accent-dark)', marginTop: 6 }}>
                  Weekly limit reached —{' '}
                  <Link href="/billing" style={{ textDecoration: 'underline', color: 'var(--accent)' }}>
                    upgrade for unlimited
                  </Link>
                </p>
              )}
            </div>
            <div className="card">
              <p className="section-label">Total focus minutes</p>
              <p className="mt-3 font-serif text-[22px] text-ink">{formatMinutes(profile.total_minutes)}</p>
            </div>
            <div className="card">
              <p className="section-label">Streak</p>
              <p className="mt-3 font-serif text-[22px] text-ink">{profile.streak ?? 0} days</p>
            </div>
          </div>

          {/* ── Main content ──────────────────────────────────────── */}
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">

            {/* Left — calendar + history */}
            <div className="space-y-6">

              {/* Calendar */}
              <section>
                <SessionCalendar
                  slots={data.monthSlots}
                  userId={profile.id}
                  isPaid={isPaid}
                  timeZone={profile.timezone || 'UTC'}
                  initialTodayIso={initialTodayIso}
                />
              </section>

              {/* History */}
              <section>
                <p className="section-label mb-3">Recent session history</p>
                <div className="card">
                  {data.recentHistory.length ? (
                    <div className="space-y-4">
                      {data.recentHistory.map((item) => (
                        <div
                          className="flex items-center gap-3"
                          key={`${item.room_id}-${item.joined_at}`}
                        >
                          <div
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: '50%',
                              background: 'var(--chip)',
                              border: '0.5px solid var(--accent-border)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 12,
                              fontWeight: 700,
                              color: 'var(--accent-dark)',
                              flexShrink: 0,
                              fontFamily: 'system-ui, -apple-system, sans-serif',
                            }}
                          >
                            {getInitials(item.partner_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p style={{ fontSize: 14, color: 'var(--ink)', fontWeight: 500 }}>
                              {item.partner_name}
                            </p>
                            <p
                              className="truncate"
                              style={{ fontSize: 13, color: 'var(--muted)' }}
                            >
                              {item.goal || 'Shared focus block'}
                            </p>
                          </div>
                          <span className="chip">{formatMinutes(25)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                      Your completed sessions will show up here after your first focus sprint.
                    </p>
                  )}
                </div>
              </section>
            </div>

            {/* ── Right sidebar ─────────────────────────────────────── */}
            <aside className="space-y-4">

              {/* Primary CTA */}
              {sessionLimitReached ? (
                <Link
                  href="/billing"
                  className="btn-primary flex w-full items-center justify-center text-[14px]"
                >
                  Upgrade to keep going →
                </Link>
              ) : (
                <Link
                  href="/match"
                  className="btn-primary flex w-full items-center justify-center text-[14px]"
                >
                  Find a partner now
                </Link>
              )}

              {/* Friends widget */}
              <FriendsSidebarWidget />

              {/* Membership card */}
              <div
                className="card"
                style={isPaid ? { border: '1.5px solid var(--accent-border)' } : {}}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <p className="section-label">Membership</p>
                  {isPaid && (
                    <span className="pro-badge">
                      {profile.plan === 'lifetime' ? 'Lifetime' : 'Pro'}
                    </span>
                  )}
                </div>

                {profile.plan === 'free' && (
                  <>
                    {/* Usage meter */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>
                        <span>Sessions used this week</span>
                        <span style={{ color: sessionLimitReached ? 'var(--accent-dark)' : 'var(--ink)', fontWeight: 600 }}>
                          {data.weeklySessions} / {FREE_WEEKLY_SESSION_LIMIT}
                        </span>
                      </div>
                      <div
                        style={{
                          height: 6,
                          borderRadius: 10,
                          background: 'var(--bdc)',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${Math.min(100, (data.weeklySessions / FREE_WEEKLY_SESSION_LIMIT) * 100)}%`,
                            background: sessionLimitReached ? 'var(--accent-dark)' : 'var(--accent)',
                            borderRadius: 10,
                            transition: 'width 0.3s',
                          }}
                        />
                      </div>
                    </div>

                    <p style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.5 }}>
                      Upgrade to Pro for unlimited sessions, scheduling, and weekly focus reports.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <Link
                        href="/billing"
                        className="btn-primary inline-flex w-full items-center justify-center text-[13px]"
                      >
                        Upgrade to Pro — $9/mo
                      </Link>
                      <Link
                        href="/billing"
                        className="btn-ghost inline-flex w-full items-center justify-center text-[12px]"
                      >
                        Or claim Lifetime — $49
                      </Link>
                    </div>
                  </>
                )}

                {profile.plan === 'pro' && (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 6 }}>
                      Pro — unlimited
                    </p>
                    <ul style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.8, marginBottom: 12, listStyle: 'none', padding: 0 }}>
                      <li>✓ Unlimited sessions</li>
                      <li>✓ Scheduling access</li>
                      <li>✓ Weekly focus reports</li>
                    </ul>
                    <Link
                      href="/billing"
                      className="btn-ghost inline-flex w-full items-center justify-center text-[12px]"
                    >
                      Manage billing
                    </Link>
                  </>
                )}

                {profile.plan === 'lifetime' && (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 700, fontFamily: 'Georgia, serif', marginBottom: 6 }}>
                      Lifetime — all features forever
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                      Thank you for being an early supporter. You have everything, forever.
                    </p>
                  </>
                )}
              </div>

              {/* Focus areas */}
              <div className="card">
                <p className="section-label mb-3">Your focus areas</p>
                {profile.focus_types?.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {profile.focus_types.map((ft: string) => (
                      <span className="chip chip-selected" key={ft}>{ft}</span>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    <Link href="/profile" style={{ color: 'var(--accent)', textDecoration: 'underline' }}>
                      Add your focus areas
                    </Link>{' '}
                    to get better partner matches.
                  </p>
                )}
              </div>

              {/* Open slots */}
              {data.openHostedSlots.length > 0 && (
                <div className="card">
                  <p className="section-label mb-3">Your open slots</p>
                  <p style={{ fontSize: 13, color: 'var(--muted)' }}>
                    {data.openHostedSlots.length} slot{data.openHostedSlots.length > 1 ? 's' : ''} waiting for a partner.
                  </p>
                  <Link href="/schedule" className="btn-ghost inline-flex w-full items-center justify-center text-[12px]" style={{ marginTop: 10 }}>
                    Manage slots
                  </Link>
                </div>
              )}

              {/* Community */}
              <div className="card">
                <p className="section-label mb-2">Community</p>
                <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 12 }}>
                  Share what you got done and meet other ADHD brains keeping gentle momentum.
                </p>
                <a
                  className="btn-ghost inline-flex w-full items-center justify-center text-[13px]"
                  href={process.env.NEXT_PUBLIC_DISCORD_INVITE_URL || '#'}
                  target="_blank"
                  rel="noreferrer"
                >
                  Join Discord
                </a>
              </div>

            </aside>
          </div>

        </div>
    </div>
  )
}
