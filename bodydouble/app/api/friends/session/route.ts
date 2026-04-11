import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { FREE_WEEKLY_SESSION_LIMIT } from '@/lib/constants'
import { LIVE_MATCH_DURATION_MINUTES } from '@/lib/constants'
import { startOfCurrentWeek } from '@/lib/utils'
import { createDailyRoom, isDailyConfigured } from '@/lib/daily'
import { getBanMessage, getUserModerationState, isUserCurrentlyBanned } from '@/lib/moderation'

export const dynamic = 'force-dynamic'

// POST — create a direct session room with a specific friend
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const moderationState = await getUserModerationState(user.id)
  if (isUserCurrentlyBanned(moderationState)) return NextResponse.json({ error: getBanMessage(moderationState) }, { status: 403 })

  const { friendId, goal } = (await request.json()) as {
    friendId: string
    goal?: string
  }
  if (!friendId) return NextResponse.json({ error: 'friendId is required.' }, { status: 400 })

  const service = createServiceClient()

  // Verify they are actually accepted friends
  const { data: friendship } = await service
    .from('friends')
    .select('id')
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${friendId}),and(user_id.eq.${friendId},friend_id.eq.${user.id})`
    )
    .eq('status', 'accepted')
    .maybeSingle()

  if (!friendship) {
    return NextResponse.json({ error: 'You are not friends with this user.' }, { status: 403 })
  }

  // Check weekly session limit for free users
  const { data: profile } = await service.from('users').select('plan').eq('id', user.id).single()
  if (profile?.plan === 'free') {
    const { count } = await service
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .gte('started_at', startOfCurrentWeek())

    if ((count ?? 0) >= FREE_WEEKLY_SESSION_LIMIT) {
      return NextResponse.json(
        { error: 'Weekly session limit reached. Upgrade for unlimited sessions.' },
        { status: 403 }
      )
    }
  }

  // Create a Daily room directly (no internal HTTP fetch)
  let roomId: string
  let roomUrl: string
  const durationMinutes = LIVE_MATCH_DURATION_MINUTES

  if (!isDailyConfigured()) {
    roomId  = `local-${crypto.randomUUID()}`
    roomUrl = `mock://${encodeURIComponent('Daily is not configured yet.')}`
  } else {
    let room: { name: string; url: string }
    try {
      room = await createDailyRoom(durationMinutes)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not create Daily room.'
      return NextResponse.json({ error: message }, { status: 500 })
    }
    roomId  = room.name
    roomUrl = room.url
  }

  // Write matched queue entries for both users so /session/[roomId] works
  const matchedAt = new Date().toISOString()

  // Upsert sender's queue entry
  await service.from('queue').delete().eq('user_id', user.id).in('status', ['waiting', 'matching', 'matched'])
  await service.from('queue').delete().eq('user_id', friendId).in('status', ['waiting', 'matching', 'matched'])

  await service.from('queue').insert([
    {
      user_id:    user.id,
      goal:       goal?.trim() ?? '',
      status:     'matched',
      room_id:    roomId,
      room_url:   roomUrl,
      duration_minutes: durationMinutes,
      partner_id: friendId,
      matched_at: matchedAt,
    },
    {
      user_id:    friendId,
      goal:       '',
      status:     'matched',
      room_id:    roomId,
      room_url:   roomUrl,
      duration_minutes: durationMinutes,
      partner_id: user.id,
      matched_at: matchedAt,
    },
  ])

  return NextResponse.json({ roomId, roomUrl })
}
