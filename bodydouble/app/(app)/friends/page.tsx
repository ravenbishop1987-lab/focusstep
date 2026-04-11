import { FriendsClient } from '@/components/friends-client'
import { requireOnboardedProfile } from '@/lib/data'

export default async function FriendsPage() {
  const profile = await requireOnboardedProfile()
  return <FriendsClient userId={profile.id} />
}
