import { OnboardingFlow } from '@/components/onboarding-flow'
import { saveOnboarding } from '@/lib/actions'
import { requireProfile } from '@/lib/data'

export default async function OnboardingPage() {
  const profile = await requireProfile()

  return (
    <OnboardingFlow action={saveOnboarding} defaultName={profile.name ?? ''} defaultTimezone={profile.timezone ?? 'UTC'} />
  )
}
