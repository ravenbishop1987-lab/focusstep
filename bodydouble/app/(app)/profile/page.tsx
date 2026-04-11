import Link from 'next/link'
import { requireOnboardedProfile } from '@/lib/data'
import { updateProfile } from '@/lib/actions'
import { SignOutButton } from '@/components/sign-out-button'
import { ClientChipGroup } from '@/components/client-chip-group'
import {
  ADHD_TYPES,
  FOCUS_TYPES,
  AVAILABILITY_OPTIONS,
  TIMEZONE_OPTIONS,
  FREE_WEEKLY_SESSION_LIMIT,
  LIFETIME_MONTHLY_SESSION_LIMIT,
  PRO_MONTHLY_SESSION_LIMIT,
} from '@/lib/constants'
import { getInitials } from '@/lib/utils'

function getGoogleErrorMessage(error?: string) {
  if (!error) {
    return null
  }

  if (error === 'oauth_not_configured') {
    return 'Google Meet connect is not configured yet. Add your Google OAuth client ID, secret, and redirect URI in the app env.'
  }

  if (error === 'access_denied') {
    return 'Google blocked the connection. If your OAuth app is still in Testing mode, only approved test users can connect until Google verification is completed.'
  }

  if (error === 'missing_refresh_token') {
    return 'Google did not return a refresh token. Try connecting again and make sure the consent screen shows account access permissions.'
  }

  if (error === 'bad_state' || error === 'missing_code') {
    return 'Google did not finish the callback cleanly. Please try Connect Google again from this page.'
  }

  return `Google connect did not finish: ${error}`
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams?: { saved?: string; google_connected?: string; google_error?: string }
}) {
  const profile = await requireOnboardedProfile()
  const saved = searchParams?.saved === '1'
  const googleConnected = searchParams?.google_connected === '1'
  const googleError = searchParams?.google_error
  const googleErrorMessage = getGoogleErrorMessage(googleError)
  const initials = getInitials(profile.name)
  const isPaid = profile.plan === 'pro' || profile.plan === 'lifetime'
  const hasGoogleMeet = Boolean(profile.google_meet_refresh_token)

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-[880px]">
        {saved ? <div className="banner mb-6 text-[13px]">Profile saved. Changes take effect immediately.</div> : null}
        {googleConnected ? <div className="banner mb-6 text-[13px]">Google account connected. New sessions can use your Google Meet.</div> : null}
        {googleErrorMessage ? (
          <div className="mb-6 rounded-[10px] bg-card px-4 py-3 text-[13px]" style={{ border: '0.5px solid var(--bdc)', color: 'var(--muted)' }}>
            {googleErrorMessage}
          </div>
        ) : null}

        <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="section-label mb-2">Account</p>
            <h1 className="text-[32px] leading-tight">Profile &amp; settings</h1>
          </div>
          <Link href="/dashboard" className="btn-ghost inline-flex items-center justify-center text-[13px]">
            Back to dashboard
          </Link>
        </div>

        <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <div className="card flex flex-col items-center gap-3 py-6 text-center">
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  background: 'var(--chip)',
                  border: '1.5px solid var(--accent-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--accent-dark)',
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div>
                <p style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', fontFamily: 'Georgia, serif' }}>
                  {profile.name ?? 'Your name'}
                </p>
                <p style={{ fontSize: 12, color: 'var(--faint)', marginTop: 3 }}>{profile.email}</p>
              </div>
              {isPaid ? <span className="pro-badge">{profile.plan === 'lifetime' ? 'Plus' : 'Core'}</span> : null}
            </div>

            <div className="card space-y-3">
              <p className="section-label">Your focus</p>
              {[
                { label: 'Total minutes', value: String(profile.total_minutes ?? 0) },
                { label: 'Current streak', value: `${profile.streak ?? 0} days` },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: 13,
                  }}
                >
                  <span style={{ color: 'var(--muted)' }}>{stat.label}</span>
                  <span style={{ fontFamily: 'Georgia, serif', fontWeight: 700, color: 'var(--ink)' }}>{stat.value}</span>
                </div>
              ))}
            </div>

            <div className="card" style={isPaid ? { border: '1.5px solid var(--accent-border)' } : {}}>
              <p className="section-label mb-2">Membership</p>
              <p
                style={{
                  fontFamily: 'Georgia, serif',
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--ink)',
                  textTransform: 'capitalize',
                  marginBottom: 8,
                }}
              >
                {profile.plan === 'pro' ? 'Core' : profile.plan === 'lifetime' ? 'Plus' : 'Free'}
              </p>

              {profile.plan === 'free' ? (
                <>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {FREE_WEEKLY_SESSION_LIMIT} sessions per week. Upgrade for more sessions, scheduling, and weekly reports.
                  </p>
                  <Link href="/billing" className="btn-primary inline-flex w-full items-center justify-center text-[13px]" style={{ marginTop: 12 }}>
                    Upgrade to Core
                  </Link>
                </>
              ) : null}

              {profile.plan === 'pro' ? (
                <>
                  <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {PRO_MONTHLY_SESSION_LIMIT} sessions each month, plus scheduling and weekly reports.
                  </p>
                  <Link href="/billing" className="btn-ghost inline-flex w-full items-center justify-center text-[13px]" style={{ marginTop: 12 }}>
                    Manage subscription
                  </Link>
                </>
              ) : null}

              {profile.plan === 'lifetime' ? (
                <p style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                  {LIFETIME_MONTHLY_SESSION_LIMIT} sessions each month with the highest priority matching and extra room for power users.
                </p>
              ) : null}
            </div>

            <SignOutButton
              className="btn-ghost w-full text-[13px]"
              style={{ cursor: 'pointer', fontFamily: 'system-ui, -apple-system, sans-serif' }}
            />
          </aside>

          <div className="space-y-5">
            <div className="card">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="section-label mb-1">Google Meet</p>
                  <h2 className="text-[26px] leading-tight">Connect your Google account</h2>
                </div>
                {hasGoogleMeet ? <span className="pro-badge">Connected</span> : null}
              </div>
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
                {hasGoogleMeet
                  ? `New sessions will use ${profile.google_meet_email ?? 'your connected Google account'} to create Google Meet links.`
                  : 'Connect your own Google account so your sessions create Google Meet links under your login instead of project-wide fallback credentials.'}
              </p>
              <p className="mt-3 text-[12px]" style={{ color: 'var(--faint)' }}>
                Anyone can use this once the Google OAuth app is published or their email is added as a Google test user while the app is still in testing.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a className="btn-primary inline-flex items-center justify-center" href="/api/google/connect">
                  {hasGoogleMeet ? 'Reconnect Google' : 'Connect Google'}
                </a>
              </div>
            </div>

            <form action={updateProfile} className="space-y-5">
              <div className="card space-y-5">
                <p className="section-label">Basic info</p>

                <div>
                  <label className="section-label mb-2 block">Display name</label>
                  <input
                    className="input"
                    defaultValue={profile.name ?? ''}
                    name="name"
                    placeholder="What should your partner call you?"
                    required
                  />
                </div>

                <div>
                  <label className="section-label mb-2 block">Timezone</label>
                  <select
                    className="input"
                    defaultValue={profile.timezone ?? 'UTC'}
                    name="timezone"
                    style={{ appearance: 'none', cursor: 'pointer' }}
                  >
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>
                        {tz.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="card">
                <p className="section-label mb-1">ADHD type</p>
                <p style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 14 }}>
                  Used to understand your experience - never shown publicly.
                </p>
                <ClientChipGroup
                  name="adhd_type"
                  options={ADHD_TYPES as unknown as string[]}
                  initialSelected={profile.adhd_type ? [profile.adhd_type] : []}
                  single
                />
              </div>

              <div className="card">
                <p className="section-label mb-1">What do you work on?</p>
                <p style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 14 }}>
                  Select everything that applies - helps match you with similar partners.
                </p>
                <ClientChipGroup
                  name="focus_types"
                  options={FOCUS_TYPES as unknown as string[]}
                  initialSelected={profile.focus_types ?? []}
                />
              </div>

              <div className="card">
                <p className="section-label mb-1">When are you usually available?</p>
                <p style={{ fontSize: 12, color: 'var(--faint)', marginBottom: 14 }}>
                  Helps surface the right scheduling slots for you.
                </p>
                <ClientChipGroup
                  name="availability"
                  options={AVAILABILITY_OPTIONS as unknown as string[]}
                  initialSelected={(profile.availability as string[]) ?? []}
                />
              </div>

              <button className="btn-primary w-full text-[14px]" type="submit">
                Save changes
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
