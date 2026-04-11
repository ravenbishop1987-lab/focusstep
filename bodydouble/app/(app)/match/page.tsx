import { MatchClient } from '@/components/match-client'
import { requireOnboardedProfile } from '@/lib/data'

export default async function MatchPage() {
  const profile = await requireOnboardedProfile()

  return <MatchClient existingGoal="" userId={profile.id} />
}
