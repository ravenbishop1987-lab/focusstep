import { SessionClient } from '@/components/session-client'
import { getSessionRoomData, requireOnboardedProfile } from '@/lib/data'

export default async function SessionRoomPage({
  params,
}: {
  params: { roomId: string }
}) {
  const profile = await requireOnboardedProfile()
  const data = await getSessionRoomData(params.roomId, profile.id)

  return (
    <SessionClient
      durationMinutes={data.durationMinutes}
      initialGoal={data.yourGoal}
      partnerId={data.partnerId}
      partnerGoal={data.partnerGoal}
      partnerName={data.partnerName}
      roomId={params.roomId}
      roomMessage={data.roomMessage}
      roomUrl={data.roomUrl}
    />
  )
}
