import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getBanMessage, getUserModerationState, isUserCurrentlyBanned } from '@/lib/moderation'

const MAX_SESSION_MINUTES = 180
const MIN_SESSION_MINUTES = 1

async function updateUserStats(userId: string, durationMinutes: number) {
  const serviceSupabase = createServiceClient()
  const today = new Date().toISOString().slice(0, 10)
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)

  const { data: profile } = await serviceSupabase.from('users').select('streak, total_minutes').eq('id', userId).single()
  const { data: lastSession } = await serviceSupabase
    .from('sessions')
    .select('started_at')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .eq('status', 'completed')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let streak = profile?.streak ?? 0

  if (!lastSession) {
    streak = 1
  } else {
    const lastDate = new Date(lastSession.started_at).toISOString().slice(0, 10)
    if (lastDate === today) {
      streak = profile?.streak ?? 0
    } else if (lastDate === yesterday) {
      streak = (profile?.streak ?? 0) + 1
    } else {
      streak = 1
    }
  }

  await serviceSupabase
    .from('users')
    .update({
      streak,
      total_minutes: (profile?.total_minutes ?? 0) + durationMinutes,
    })
    .eq('id', userId)

  return streak
}

export async function POST(request: Request) {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  const moderationState = await getUserModerationState(user.id)
  if (isUserCurrentlyBanned(moderationState)) {
    return NextResponse.json({ error: getBanMessage(moderationState) }, { status: 403 })
  }

  const body = (await request.json()) as {
    roomId: string
    goal: string
    durationMinutes: number
  }

  const roomId = String(body.roomId ?? '').trim()
  const goal = String(body.goal ?? '').trim().slice(0, 500)

  if (!roomId) {
    return NextResponse.json({ error: 'roomId is required.' }, { status: 400 })
  }

  const { data: queueEntries } = await serviceSupabase
    .from('queue')
    .select('user_id, goal, matched_at, duration_minutes')
    .eq('room_id', roomId)
    .eq('status', 'matched')

  const current = queueEntries?.find((entry) => entry.user_id === user.id)
  const partner = queueEntries?.find((entry) => entry.user_id !== user.id)

  if (!current) {
    return NextResponse.json({ error: 'This room is not active for your account.' }, { status: 403 })
  }

  const matchedAt = current.matched_at ?? null
  const configuredDuration = current.duration_minutes ?? MIN_SESSION_MINUTES
  const now = new Date()

  const trustedDurationMinutes = matchedAt
    ? Math.max(
        MIN_SESSION_MINUTES,
        Math.min(
          MAX_SESSION_MINUTES,
          Math.round((now.getTime() - new Date(matchedAt).getTime()) / 60000)
        )
      )
    : Math.max(
        MIN_SESSION_MINUTES,
        Math.min(
          MAX_SESSION_MINUTES,
          Number.isFinite(body.durationMinutes) ? Math.round(body.durationMinutes) : configuredDuration
        )
      )

  const sessionDurationMinutes = Math.max(
    MIN_SESSION_MINUTES,
    Math.min(MAX_SESSION_MINUTES, Math.min(configuredDuration, trustedDurationMinutes))
  )

  await serviceSupabase.from('sessions').insert({
    room_id: roomId,
    user1_id: user.id,
    user2_id: partner?.user_id ?? null,
    started_at: new Date(now.getTime() - sessionDurationMinutes * 60000).toISOString(),
    ended_at: now.toISOString(),
    duration_minutes: sessionDurationMinutes,
    user1_goal: goal || current?.goal || '',
    user2_goal: partner?.goal ?? '',
    status: 'completed',
  })

  await serviceSupabase.from('queue').delete().eq('room_id', roomId)

  const streak = await updateUserStats(user.id, sessionDurationMinutes)
  if (partner?.user_id) {
    await updateUserStats(partner.user_id, sessionDurationMinutes)
  }

  return NextResponse.json({ durationMinutes: sessionDurationMinutes, streak })
}
