import { CheckoutButton, PortalButton } from '@/components/checkout-button'
import {
  FREE_WEEKLY_SESSION_LIMIT,
  LIFETIME_MONTHLY_SESSION_LIMIT,
  PRO_MONTHLY_SESSION_LIMIT,
} from '@/lib/constants'
import { getCurrentUserProfile, requireOnboardedProfile } from '@/lib/data'
import { syncUserPlanFromCheckoutSession } from '@/lib/stripe-sync'

export default async function BillingPage({
  searchParams,
}: {
  searchParams?: { success?: string; canceled?: string; session_id?: string }
}) {
  if (searchParams?.success === '1' && searchParams.session_id) {
    await syncUserPlanFromCheckoutSession(searchParams.session_id)
  }

  const profile = (await getCurrentUserProfile()) ?? (await requireOnboardedProfile())
  const corePriceId = process.env.STRIPE_PRO_PRICE_ID ?? ''
  const plusPriceId = process.env.STRIPE_LIFETIME_PRICE_ID ?? ''
  const success = searchParams?.success === '1'
  const canceled = searchParams?.canceled === '1'

  const isCore = profile.plan === 'pro'
  const isPlus = profile.plan === 'lifetime'
  const isPaid = isCore || isPlus
  const hasStripeCustomer = Boolean(profile.stripe_customer_id)
  const currentPlanLabel =
    profile.plan === 'pro' ? 'Keep Going' : profile.plan === 'lifetime' ? 'Actually Finish' : 'Start Small'

  return (
    <div className="page-shell">
      <div className="mx-auto max-w-[1120px]">
        {success ? (
          <div className="banner mb-5 text-[13px]">
            Your plan has been updated. It may take a moment for Stripe to confirm the latest status.
          </div>
        ) : null}
        {canceled ? (
          <div
            className="mb-5 rounded-[10px] px-4 py-3 text-[13px]"
            style={{ background: 'var(--card)', border: '0.5px solid var(--bdc)', color: 'var(--muted)' }}
          >
            Checkout was canceled. Your current plan is unchanged.
          </div>
        ) : null}

        <div className="mb-8">
          <p className="section-label mb-3">Pricing</p>
          <h1 className="text-[34px] leading-tight">When your brain won&apos;t start, this helps you begin.</h1>
          <p className="mt-2 text-[14px]" style={{ color: 'var(--muted)' }}>
            Less overthinking. Less getting stuck. More done.
          </p>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <div className="card">
            <p className="section-label">Current plan</p>
            <p className="mt-3 font-serif text-[24px] text-ink">{currentPlanLabel}</p>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>
              {isPaid ? 'You have extra support ready when your focus slips.' : 'Start free, then upgrade if you want steadier support.'}
            </p>
          </div>
          <div className="card">
            <p className="section-label">Session allowance</p>
            <p className="mt-3 font-serif text-[24px] text-ink">
              {profile.plan === 'pro'
                ? `${PRO_MONTHLY_SESSION_LIMIT}/month`
                : profile.plan === 'lifetime'
                  ? `${LIFETIME_MONTHLY_SESSION_LIMIT}/month`
                  : `${FREE_WEEKLY_SESSION_LIMIT}/week`}
            </p>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>
              {profile.plan === 'pro'
                ? `${PRO_MONTHLY_SESSION_LIMIT} matched sessions reset on the first of each month.`
                : profile.plan === 'lifetime'
                  ? `${LIFETIME_MONTHLY_SESSION_LIMIT} matched sessions reset on the first of each month.`
                  : `${FREE_WEEKLY_SESSION_LIMIT} matched sessions reset each Monday.`}
            </p>
          </div>
          <div className="card">
            <p className="section-label">Scheduling</p>
            <p className="mt-3 font-serif text-[24px] text-ink">{isPaid ? 'Included' : 'Locked'}</p>
            <p className="mt-2 text-[13px]" style={{ color: 'var(--muted)' }}>
              {isPaid ? 'Book support ahead so you do not have to decide in the moment.' : 'Available on Keep Going and Actually Finish.'}
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="grid gap-5 md:grid-cols-3">
            <div className="card flex flex-col justify-between gap-6">
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="section-label">Start Small</p>
                    <h2 className="mt-2 text-[28px]">$0</h2>
                  </div>
                  {profile.plan === 'free' ? <span className="pro-badge">Current</span> : null}
                </div>
                <ul className="space-y-2.5 text-[13px]" style={{ color: 'var(--body)' }}>
                  {[
                    'Get help when a task feels too big',
                    'Turn "I can\'t do this" into one simple next step',
                    `Try body doubling with ${FREE_WEEKLY_SESSION_LIMIT} sessions each week`,
                    'Best if you want quick relief without pressure',
                  ].map((feature) => (
                    <li className="flex items-start gap-2" key={feature}>
                      <span style={{ color: 'var(--accent)' }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div
              className="card flex flex-col justify-between gap-6"
              style={isCore ? { border: '2px solid var(--accent-border)' } : {}}
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="section-label">Keep Going</p>
                    <h2 className="mt-2 text-[28px]">$9 / month</h2>
                  </div>
                  {isCore ? <span className="pro-badge">Active</span> : <span className="pro-badge">More support</span>}
                </div>
                <ul className="space-y-2.5 text-[13px]" style={{ color: 'var(--body)' }}>
                  {[
                    'Get unstuck as often as you need during the month',
                    'Stay with tasks longer instead of giving up halfway',
                    'Book support ahead so you do not have to think about it later',
                    `Get more room with ${PRO_MONTHLY_SESSION_LIMIT} body doubling sessions each month`,
                  ].map((feature) => (
                    <li className="flex items-start gap-2" key={feature}>
                      <span style={{ color: 'var(--accent)' }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              {isCore ? (
                hasStripeCustomer ? <PortalButton label="Manage subscription" /> : null
              ) : (
                <CheckoutButton
                  disabled={isPlus}
                  label={isPlus ? 'You have Actually Finish' : 'Get More Support'}
                  mode="subscription"
                  planKey="pro"
                  priceId={corePriceId}
                />
              )}
            </div>

            <div
              className="card flex flex-col justify-between gap-6"
              style={!isPlus ? { border: '2px solid var(--accent-border)', boxShadow: '0 10px 30px rgba(107, 143, 113, 0.12)' } : { border: '2px solid var(--accent-border)' }}
            >
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="section-label">Actually Finish</p>
                    <h2 className="mt-2 text-[28px]">$19 / month</h2>
                  </div>
                  {isPlus ? <span className="pro-badge">Active</span> : <span className="pro-badge">Real solution</span>}
                </div>
                <ul className="space-y-2.5 text-[13px]" style={{ color: 'var(--body)' }}>
                  {[
                    'Get the kind of support that helps you start and stay with it',
                    `Use body doubling often with ${LIFETIME_MONTHLY_SESSION_LIMIT} sessions each month`,
                    'Build real momentum instead of always restarting',
                    'See what helps you focus so progress feels less random',
                    'Best for people who are tired of falling behind and want real support',
                  ].map((feature) => (
                    <li className="flex items-start gap-2" key={feature}>
                      <span style={{ color: 'var(--accent)' }}>✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              <CheckoutButton
                disabled={isPlus}
                label={isPlus ? 'Actually Finish active' : 'Start Finishing Tasks'}
                mode="subscription"
                planKey="lifetime"
                priceId={plusPriceId}
              />
            </div>
          </div>

          <aside className="space-y-4">
            <div className="card">
              <p className="section-label mb-3">Why people upgrade</p>
              <div className="space-y-3 text-[13px]" style={{ color: 'var(--muted)' }}>
                {[
                  { label: 'Start Small', value: 'Quick relief when you feel stuck' },
                  { label: 'Keep Going', value: 'More support through the month' },
                  { label: 'Actually Finish', value: 'The full support plan' },
                  { label: 'Free body doubling', value: `${FREE_WEEKLY_SESSION_LIMIT} / week` },
                  { label: 'Keep Going body doubling', value: `${PRO_MONTHLY_SESSION_LIMIT} / month` },
                  { label: 'Actually Finish body doubling', value: `${LIFETIME_MONTHLY_SESSION_LIMIT} / month` },
                  { label: 'Strong reason to upgrade', value: 'Free helps you start. Actually Finish helps you keep going long enough to finish.' },
                ].map((row, index, rows) => (
                  <div
                    className="flex items-center justify-between gap-4"
                    key={row.label}
                    style={index < rows.length - 1 ? { borderBottom: '0.5px solid var(--bdc)', paddingBottom: 10 } : {}}
                  >
                    <span>{row.label}</span>
                    <span className="text-ink">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {isPaid && hasStripeCustomer ? (
              <div className="card">
                <p className="section-label mb-3">Manage billing</p>
                <p className="mb-3 text-[13px]" style={{ color: 'var(--muted)' }}>
                  Update your payment method, view invoices, or cancel your subscription via the Stripe portal.
                </p>
                <PortalButton label="Open billing portal" />
              </div>
            ) : null}

            <div className="card">
              <p className="section-label mb-3">A gentle note</p>
              <p className="text-[13px]" style={{ color: 'var(--muted)' }}>
                Upgrade if you want enough support to change your week, not just survive one hard day.
              </p>
            </div>
          </aside>
        </div>

        <div className="mt-8 card">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="section-label mb-3">Billing questions</p>
              <h2 className="text-[28px] leading-tight">A few practical notes.</h2>
            </div>
            <div className="space-y-5 md:col-span-2">
              {[
                {
                  q: 'What happens on the free plan?',
                  a: `You get 3 task translations per day and ${FREE_WEEKLY_SESSION_LIMIT} Body Double sessions per week. It is meant to help you start without pressure.`,
                },
                {
                  q: 'What does Keep Going include?',
                  a: `Keep Going gives you unlimited task translations, ${PRO_MONTHLY_SESSION_LIMIT} Body Double sessions per month, scheduling, and faster access to support when you need it.`,
                },
                {
                  q: 'What does Actually Finish include?',
                  a: `Actually Finish gives you everything in Keep Going, ${LIFETIME_MONTHLY_SESSION_LIMIT} Body Double sessions per month, and deeper focus insights so support feels less random.`,
                },
                {
                  q: 'Can I cancel any time?',
                  a: 'Yes. Cancel from the Stripe portal and the plan reverts to free at the end of the billing period.',
                },
              ].map((item) => (
                <div key={item.q}>
                  <p className="text-[14px] font-medium text-ink">{item.q}</p>
                  <p className="mt-1.5 text-[13px]" style={{ color: 'var(--muted)' }}>
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
