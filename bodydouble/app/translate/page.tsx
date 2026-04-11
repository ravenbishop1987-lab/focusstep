import { TranslateClient } from '@/components/translate-client'
import { PublicHeader } from '@/components/public-header'
import { getCurrentUserProfile } from '@/lib/data'

export default async function PublicTranslatePage() {
  const profile = await getCurrentUserProfile()
  const isPaid = profile?.plan === 'pro' || profile?.plan === 'lifetime'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <PublicHeader
        ctaHref={profile ? '/match' : '/auth'}
        ctaLabel="Try Body Double"
        secondaryHref={profile ? '/dashboard' : '/auth'}
        secondaryLabel={profile ? 'Dashboard' : 'Sign in'}
      />

      <main style={{ maxWidth: 1120, margin: '0 auto', padding: '32px 16px 64px' }} className="md:px-6 md:pb-20 md:pt-10">
        <TranslateClient
          userEmail={profile?.email ?? ''}
          userId={profile?.id ?? ''}
          isPaid={Boolean(isPaid)}
          plan={profile?.plan ?? 'free'}
          isSignedIn={Boolean(profile)}
        />
      </main>
    </div>
  )
}
