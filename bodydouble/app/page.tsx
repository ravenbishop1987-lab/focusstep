import Link from 'next/link'
import { redirect } from 'next/navigation'
import { APP_NAME, FREE_WEEKLY_SESSION_LIMIT } from '@/lib/constants'
import { BrandLockup } from '@/components/brand-lockup'
import { getCurrentUserProfile } from '@/lib/data'
import { FaqAccordion } from '@/components/faq-accordion'
import { NewsletterForm } from '@/components/newsletter-form'

const features = [
  {
    icon: '⟳',
    title: 'Instant matching',
    body: 'Get paired with a real person in under 60 seconds — no scheduling required.',
  },
  {
    icon: '◎',
    title: 'Silent accountability',
    body: 'No talking, no small talk. Shared quiet presence is the whole mechanism.',
  },
  {
    icon: '◷',
    title: '25-minute sprints',
    body: 'The Pomodoro timer runs on-screen so you always know where you are.',
  },
  {
    icon: '○',
    title: 'Camera stays optional',
    body: 'You choose what feels safe. Many people never turn their camera on.',
  },
  {
    icon: '↗',
    title: 'Google Meet built in',
    body: 'One click opens your session. No extra apps, no account setup required.',
  },
  {
    icon: '◈',
    title: 'Streak tracking',
    body: 'See your momentum build across days. Small, steady focus counts.',
  },
]

const testimonials = [
  {
    stars: 5,
    quote: 'I stop negotiating with my to-do list and just begin. That alone is worth everything.',
    author: 'Jordan M.',
    tag: 'ADHD-PI diagnosis 2019',
  },
  {
    stars: 5,
    quote: 'The body doubling effect is real. I finished more in one session than I had all week.',
    author: 'Jamie P.',
    tag: 'ADHD founder, writer',
  },
  {
    stars: 5,
    quote: 'Finally something that feels calm instead of overwhelming. I actually look forward to it.',
    author: 'Chris L.',
    tag: 'Grad student, ADHD',
  },
]

const faqItems = [
  {
    q: 'Do I need to create an account?',
    a: `You need an account to save your streak and match history, but you can sign up in under a minute with Google.`,
  },
  {
    q: 'Do I have to talk to my partner?',
    a: 'No. You each share your goal at the start, then work in silence. Quiet company is the whole point.',
  },
  {
    q: 'What if I\'m still stuck after joining the session?',
    a: 'That\'s okay. Just being present with another person often helps the ADHD brain settle. There\'s no pressure to perform.',
  },
  {
    q: 'Can I cancel my Pro subscription?',
    a: 'Yes, any time. Cancel from the billing portal and you stay on Pro until the end of the billing period.',
  },
  {
    q: 'Does the Lifetime plan include future features?',
    a: 'Yes. Everything we build goes to Lifetime members. This early-access price won\'t last.',
  },
  {
    q: 'Is my data private?',
    a: 'Your goal text and session data are only visible to you. We never share or sell personal data.',
  },
]

export default async function HomePage() {
  const profile = await getCurrentUserProfile()

  if (profile) {
    if (!profile.onboarding_done) redirect('/onboarding')
    redirect('/dashboard')
  }

  redirect('/translate')

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>

      {/* ── NAV ──────────────────────────────────────────────────────── */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          background: 'var(--bg)',
          borderBottom: '0.5px solid var(--bdc)',
          padding: '0 24px',
          height: 52,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center' }}>
          <BrandLockup compact />
        </span>

        <nav
          style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 13, color: 'var(--muted)' }}
          className="hidden md:flex"
        >
          <a href="#features"    style={{ color: 'var(--muted)' }}>Features</a>
          <a href="#how-it-works" style={{ color: 'var(--muted)' }}>How it works</a>
          <a href="#pricing"     style={{ color: 'var(--muted)' }}>Pricing</a>
        </nav>

        <Link
          href="/auth"
          style={{
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 13,
            fontWeight: 500,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            minHeight: 36,
          }}
        >
          Try Free →
        </Link>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────── */}
      <section
        style={{
          textAlign: 'center',
          padding: '72px 24px 64px',
          maxWidth: 760,
          margin: '0 auto',
        }}
      >
        {/* Badge */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--chip)',
            border: '0.5px solid var(--accent-border)',
            borderRadius: 20,
            padding: '4px 14px',
            fontSize: 12,
            color: 'var(--accent-dark)',
            fontWeight: 500,
            marginBottom: 32,
          }}
        >
          ✦ Built for ADHD brains
        </div>

        {/* Heading */}
        <h1
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(38px, 6vw, 62px)',
            fontWeight: 700,
            color: 'var(--ink)',
            lineHeight: 1.08,
            margin: 0,
          }}
        >
          Work alongside a stranger
          <br />
          and actually{' '}
          <em style={{ fontStyle: 'italic', color: 'var(--accent)' }}>get things done.</em>
        </h1>

        <p
          style={{
            marginTop: 22,
            fontSize: 16,
            color: 'var(--muted)',
            lineHeight: 1.65,
            maxWidth: 560,
            margin: '22px auto 0',
          }}
        >
          Paste what feels stuck. {APP_NAME} matches you with a real person, you both share
          what you&rsquo;re working on, then focus together for 25 quiet minutes via Google Meet.
          ADHD-friendly and completely calm.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 36, flexWrap: 'wrap' }}>
          <Link
            href="/auth"
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 26px',
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 46,
            }}
          >
            Try it free — no signup needed
          </Link>
          <Link
            href="#pricing"
            style={{
              background: 'transparent',
              border: '0.5px solid var(--bdm)',
              borderRadius: 20,
              padding: '12px 22px',
              fontSize: 14,
              color: 'var(--muted)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              minHeight: 46,
            }}
          >
            See Pro plans
          </Link>
        </div>

        {/* Trust line */}
        <p style={{ marginTop: 20, fontSize: 12, color: 'var(--faint)' }}>
          {FREE_WEEKLY_SESSION_LIMIT} free sessions per week &nbsp;·&nbsp; Pro from $9/mo &nbsp;·&nbsp; Camera always optional
        </p>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────────────── */}
      <section
        id="how-it-works"
        style={{
          maxWidth: 860,
          margin: '0 auto',
          padding: '0 24px 72px',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 24,
          }}
          className="grid-cols-1 md:grid-cols-3"
        >
          {[
            {
              n: '1',
              title: 'Share your goal',
              body: 'Write one sentence about what you want to do. No overthinking, no setup spiral.',
            },
            {
              n: '2',
              title: 'Get matched instantly',
              body: 'Meet a real person who is also ready to focus right now. Under 60 seconds.',
            },
            {
              n: '3',
              title: 'Work side by side',
              body: 'Open the Google Meet, keep the timer close, and let momentum arrive without forcing it.',
            },
          ].map((step) => (
            <div key={step.n} style={{ textAlign: 'center' }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--accent)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 15,
                  fontWeight: 700,
                  margin: '0 auto 14px',
                  fontFamily: 'Georgia, serif',
                }}
              >
                {step.n}
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, fontFamily: 'Georgia, serif' }}>
                {step.title}
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── DEMO PREVIEW ─────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: '0 24px 80px',
        }}
      >
        <p style={{ textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 16 }}>
          See it in action
        </p>
        <h2
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(26px, 4vw, 36px)',
            fontWeight: 700,
            color: 'var(--ink)',
            textAlign: 'center',
            marginBottom: 32,
            lineHeight: 1.15,
          }}
        >
          This is what a session looks like — instantly.
        </h2>

        {/* Mock session UI */}
        <div
          style={{
            background: 'var(--card)',
            border: '0.5px solid var(--bdc)',
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {/* Top bar */}
          <div
            style={{
              background: 'var(--subtle)',
              borderBottom: '0.5px solid var(--accent-light)',
              padding: '10px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <span style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)' }}>
                Live session
              </span>
              <p style={{ fontSize: 13, color: 'var(--accent-dark)', marginTop: 2, fontWeight: 500 }}>
                Session with Alex · studying for finals
              </p>
            </div>
            <span
              style={{
                background: 'var(--chip)',
                border: '0.5px solid var(--accent-border)',
                borderRadius: 20,
                padding: '2px 10px',
                fontSize: 11,
                color: 'var(--accent-dark)',
                fontWeight: 500,
              }}
            >
              Camera optional
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 240px' }} className="flex-col md:grid">
            {/* Meet placeholder */}
            <div
              style={{
                background: 'var(--bg)',
                minHeight: 220,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 14,
                padding: 24,
                borderRight: '0.5px solid var(--bdc)',
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
                  fontSize: 20,
                  color: 'var(--accent)',
                }}
              >
                ▶
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted)', textAlign: 'center', maxWidth: 220, lineHeight: 1.5 }}>
                Google Meet opens in its own tab. Camera is optional. This page holds your timer and goals.
              </p>
              <div
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 8,
                  padding: '8px 20px',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: 'default',
                }}
              >
                Join Google Meet
              </div>
            </div>

            {/* Sidebar */}
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Timer */}
              <div style={{ textAlign: 'center', paddingBottom: 12, borderBottom: '0.5px solid var(--bdc)' }}>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 6 }}>
                  Pomodoro
                </p>
                <p style={{ fontFamily: 'Georgia, serif', fontSize: 34, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
                  24:17
                </p>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 8 }}>
                  {['Pause', 'Reset'].map((lbl) => (
                    <span
                      key={lbl}
                      style={{
                        border: '0.5px solid var(--bdm)',
                        borderRadius: 20,
                        padding: '4px 10px',
                        fontSize: 11,
                        color: 'var(--muted)',
                        cursor: 'default',
                      }}
                    >
                      {lbl}
                    </span>
                  ))}
                </div>
              </div>

              {/* Goals */}
              <div>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 6 }}>
                  Your goal
                </p>
                <div style={{ background: 'var(--bg)', border: '0.5px solid var(--bdc)', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: 'var(--body)' }}>
                  Finish the proposal draft
                </div>
              </div>
              <div>
                <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 6 }}>
                  Partner goal
                </p>
                <div
                  style={{
                    background: 'var(--chip)',
                    border: '0.5px solid var(--accent-border)',
                    borderRadius: 20,
                    padding: '5px 12px',
                    fontSize: 12,
                    color: 'var(--accent-dark)',
                    display: 'inline-block',
                  }}
                >
                  Studying for finals
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ─────────────────────────────────────────────────── */}
      <section
        id="features"
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 24px 80px',
        }}
      >
        <p style={{ textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 14 }}>
          Features
        </p>
        <h2
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(26px, 4vw, 38px)',
            fontWeight: 700,
            color: 'var(--ink)',
            textAlign: 'center',
            maxWidth: 560,
            margin: '0 auto 10px',
            lineHeight: 1.15,
          }}
        >
          Everything your ADHD brain needs to actually get started.
        </h2>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)', marginBottom: 40 }}>
          Not another to-do list. A tool that turns the urge to focus into shared momentum.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
          className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
        >
          {features.map((f) => (
            <div
              key={f.title}
              style={{
                background: 'var(--card)',
                border: '0.5px solid var(--bdc)',
                borderRadius: 14,
                padding: '20px 18px',
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: 'var(--subtle)',
                  border: '0.5px solid var(--accent-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 16,
                  color: 'var(--accent)',
                  marginBottom: 12,
                }}
              >
                {f.icon}
              </div>
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)', marginBottom: 6, fontFamily: 'Georgia, serif' }}>
                {f.title}
              </p>
              <p style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── TESTIMONIALS ─────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 960,
          margin: '0 auto',
          padding: '0 24px 80px',
        }}
      >
        <p style={{ textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 14 }}>
          What people are saying
        </p>
        <h2
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(26px, 4vw, 38px)',
            fontWeight: 700,
            color: 'var(--ink)',
            textAlign: 'center',
            marginBottom: 36,
          }}
        >
          Real people. Real results.
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }} className="grid-cols-1 md:grid-cols-3">
          {testimonials.map((t) => (
            <div
              key={t.quote}
              style={{
                background: 'var(--card)',
                border: '0.5px solid var(--bdc)',
                borderRadius: 14,
                padding: '22px 20px',
              }}
            >
              {/* Stars */}
              <div style={{ color: 'var(--accent)', fontSize: 13, marginBottom: 12, letterSpacing: 2 }}>
                {'★'.repeat(t.stars)}
              </div>
              <p style={{ fontFamily: 'Georgia, serif', fontSize: 16, color: 'var(--ink)', lineHeight: 1.55, marginBottom: 16 }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--body)' }}>{t.author}</p>
              <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 2 }}>{t.tag}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ──────────────────────────────────────────────────── */}
      <section
        id="pricing"
        style={{
          maxWidth: 900,
          margin: '0 auto',
          padding: '0 24px 80px',
        }}
      >
        <p style={{ textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 14 }}>
          Pricing
        </p>
        <h2
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(26px, 4vw, 38px)',
            fontWeight: 700,
            color: 'var(--ink)',
            textAlign: 'center',
            marginBottom: 10,
          }}
        >
          Start free. Upgrade when ready.
        </h2>
        <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--muted)', marginBottom: 40 }}>
          No account required to start. {FREE_WEEKLY_SESSION_LIMIT} sessions free, then upgrade for unlimited whenever you need it.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, alignItems: 'start' }} className="grid-cols-1 md:grid-cols-3">

          {/* Free */}
          <div style={{ background: 'var(--card)', border: '0.5px solid var(--bdc)', borderRadius: 16, padding: '28px 22px' }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 10 }}>Free</p>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>$0</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, marginBottom: 20 }}>Always free</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                `${FREE_WEEKLY_SESSION_LIMIT} task breakdowns per week`,
                '25-minute focus blocks',
                'Google Meet integration',
                'Streak tracking',
                'Make it more specific',
              ].map((f) => (
                <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--body)', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <Link
              href="/auth"
              style={{
                display: 'block',
                textAlign: 'center',
                background: 'transparent',
                border: '0.5px solid var(--bdm)',
                borderRadius: 20,
                padding: '10px',
                fontSize: 13,
                color: 'var(--muted)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Try for free →
            </Link>
          </div>

          {/* Pro Monthly — highlighted */}
          <div
            style={{
              background: 'var(--card)',
              border: '2px solid var(--accent)',
              borderRadius: 16,
              padding: '28px 22px',
              position: 'relative',
            }}
          >
            {/* Most popular badge */}
            <div
              style={{
                position: 'absolute',
                top: -13,
                left: '50%',
                transform: 'translateX(-50%)',
                background: 'var(--accent)',
                color: '#fff',
                borderRadius: 20,
                padding: '3px 14px',
                fontSize: 11,
                fontWeight: 600,
                whiteSpace: 'nowrap',
              }}
            >
              MOST POPULAR
            </div>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 10 }}>Pro Monthly</p>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>
              $9
              <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--muted)', fontFamily: 'system-ui' }}>/month</span>
            </p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, marginBottom: 20 }}>Cancel any time</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Unlimited body doubling sessions',
                'Translation history',
                'Scheduling access',
                'All free features',
                'Cancel any time',
              ].map((f) => (
                <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--body)', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <Link
              href="/auth"
              style={{
                display: 'block',
                textAlign: 'center',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                padding: '11px',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Get Pro Monthly →
            </Link>
          </div>

          {/* Pro Lifetime */}
          <div style={{ background: 'var(--card)', border: '0.5px solid var(--bdc)', borderRadius: 16, padding: '28px 22px' }}>
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 10 }}>Pro Lifetime</p>
            <p style={{ fontFamily: 'Georgia, serif', fontSize: 36, fontWeight: 700, color: 'var(--ink)', lineHeight: 1 }}>$49</p>
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4, marginBottom: 20 }}>One-time · Early access</p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                'Everything in Pro Monthly',
                'Never pay again',
                'All future features included',
                'Best value',
              ].map((f) => (
                <li key={f} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--body)', alignItems: 'flex-start' }}>
                  <span style={{ color: 'var(--accent)', flexShrink: 0 }}>✓</span>{f}
                </li>
              ))}
            </ul>
            <Link
              href="/auth"
              style={{
                display: 'block',
                textAlign: 'center',
                background: 'transparent',
                border: '0.5px solid var(--bdm)',
                borderRadius: 20,
                padding: '10px',
                fontSize: 13,
                color: 'var(--muted)',
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              Start Lifetime Access →
            </Link>
          </div>

        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────── */}
      <section
        style={{
          maxWidth: 680,
          margin: '0 auto',
          padding: '0 24px 80px',
        }}
      >
        <p style={{ textAlign: 'center', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--faint)', marginBottom: 14 }}>
          FAQ
        </p>
        <h2
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(26px, 4vw, 38px)',
            fontWeight: 700,
            color: 'var(--ink)',
            textAlign: 'center',
            marginBottom: 40,
          }}
        >
          Common questions.
        </h2>

        <FaqAccordion items={faqItems} />
      </section>

      {/* ── NEWSLETTER / CTA ─────────────────────────────────────────── */}
      <section
        style={{
          background: 'var(--accent-dark)',
          padding: '56px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--accent-light)', marginBottom: 14 }}>
          Stay in the loop
        </p>
        <h2
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 'clamp(22px, 3.5vw, 32px)',
            fontWeight: 700,
            color: '#fff',
            marginBottom: 10,
            lineHeight: 1.2,
          }}
        >
          Get weekly ADHD focus tips.
        </h2>
        <p style={{ fontSize: 14, color: 'var(--accent-light)', marginBottom: 28, maxWidth: 400, margin: '0 auto 28px' }}>
          One email a week. Real tips for getting unstuck. No spam, no fluff, unsubscribe any time.
        </p>
        <NewsletterForm />
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────── */}
      <footer
        style={{
          background: 'var(--accent-dark)',
          borderTop: '0.5px solid rgba(255,255,255,0.1)',
          padding: '20px 24px',
          textAlign: 'center',
        }}
      >
        <p style={{ fontSize: 12, color: 'var(--accent-light)', marginBottom: 6 }}>
          © {APP_NAME}
        </p>
        <p style={{ fontSize: 11, color: 'rgba(184,212,184,0.6)' }}>
          Made with care for ADHD brains. No hustle energy here.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 12, fontSize: 12 }}>
          {[
            { href: '/auth',    label: 'Sign in' },
            { href: '#pricing', label: 'Pricing' },
            { href: '#faq',     label: 'FAQ' },
          ].map((l) => (
            <a
              key={l.href}
              href={l.href}
              style={{ color: 'var(--accent-light)', textDecoration: 'none' }}
            >
              {l.label}
            </a>
          ))}
        </div>
      </footer>

    </div>
  )
}
