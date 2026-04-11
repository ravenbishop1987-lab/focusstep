import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import {
  FREE_WEEKLY_SESSION_LIMIT,
  LIFETIME_MONTHLY_SESSION_LIMIT,
  LIVE_MATCH_DURATION_MINUTES,
  PRO_MONTHLY_SESSION_LIMIT,
} from '@/lib/constants'
import { startOfCurrentWeek } from '@/lib/utils'
import { sendUpgradePromptEmail } from '@/lib/email'
import { createDailyRoom, isDailyConfigured } from '@/lib/daily'
import { getBanMessage, getUserModerationState, isUserCurrentlyBanned } from '@/lib/moderation'

function buildMockMeeting(message: string) {
  return {
    roomName: `local-${crypto.randomUUID()}`,
    roomUrl: `mock://${encodeURIComponent(message)}`,
    provider: 'mock' as const,
    message,
  }
}

function isMissingDurationColumnError(error: { message?: string } | null) {
  return Boolean(error?.message?.includes('duration_minutes'))
}

function shouldUseLegacyMatchFlow(error: { message?: string; code?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    message.includes('claim_match_pair') ||
    message.includes('function public.claim_match_pair') ||
    message.includes('matching') ||
    error?.code === 'PGRST202'
  )
}

type MatchClaimRow = {
  current_queue_id: string | null
  partner_queue_id: string | null
  partner_user_id: string | null
  status: 'idle' | 'waiting' | 'matching' | 'matched'
  room_id: string | null
}

async function getLegacyMatchState(serviceSupabase: ReturnType<typeof createServiceClient>, userId: string) {
  const { data: current } = await serviceSupabase
    .from('queue')
    .select('*')
    .eq('user_id', userId)
    .in('status', ['waiting', 'matched'])
    .order('joined_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!current) {
    return { status: 'idle' as const }
  }

  if (current.status === 'matched' && current.room_id) {
    return { roomId: current.room_id }
  }

  const waitingResult = await serviceSupabase
    .from('queue')
    .select('*, user:users!queue_user_id_fkey(id, plan)')
    .eq('status', 'waiting')
    .neq('user_id', userId)
    .order('joined_at', { ascending: true })

  const candidates = (waitingResult.data ?? []).sort((a, b) => {
    const aPriority = a.user?.plan === 'pro' || a.user?.plan === 'lifetime' ? 0 : 1
    const bPriority = b.user?.plan === 'pro' || b.user?.plan === 'lifetime' ? 0 : 1
    return aPriority - bPriority
  })
  const partner = candidates.at(0)

  if (!partner) {
    return { status: 'waiting' as const }
  }

  return {
    status: 'pair-found' as const,
    currentId: current.id as string,
    partnerId: partner.id as string,
    partnerUserId: partner.user_id as string,
  }
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

  const { data: profile } = await serviceSupabase.from('users').select('*').eq('id', user.id).single()
  if (!profile?.onboarding_done) {
    return NextResponse.json({ error: 'Please finish onboarding first.' }, { status: 400 })
  }

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  if (profile.plan === 'free') {
    const { count } = await serviceSupabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .gte('started_at', startOfCurrentWeek())

    if ((count ?? 0) >= FREE_WEEKLY_SESSION_LIMIT) {
      if (profile.email) {
        await sendUpgradePromptEmail(profile.email, profile.name ?? 'there')
      }
      return NextResponse.json(
        { error: 'You have used this week’s free sessions. Upgrade for unlimited matching.' },
        { status: 403 }
      )
    }
  }

  if (profile.plan === 'pro') {
    const { count } = await serviceSupabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .gte('started_at', monthStart)

    if ((count ?? 0) >= PRO_MONTHLY_SESSION_LIMIT) {
      return NextResponse.json(
        {
          error: `You have used your ${PRO_MONTHLY_SESSION_LIMIT} Core sessions for this month. Upgrade to Plus for more room.`,
        },
        { status: 403 }
      )
    }
  }

  if (profile.plan === 'lifetime') {
    const { count } = await serviceSupabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .gte('started_at', monthStart)

    if ((count ?? 0) >= LIFETIME_MONTHLY_SESSION_LIMIT) {
      return NextResponse.json(
        {
          error: `You have reached your ${LIFETIME_MONTHLY_SESSION_LIMIT} Plus sessions for this month.`,
        },
        { status: 403 }
      )
    }
  }

  const body = (await request.json().catch(() => ({}))) as { goal?: string }
  const durationMinutes = LIVE_MATCH_DURATION_MINUTES

  const { data: existingMatch } = await serviceSupabase
    .from('queue')
    .select('room_id, room_url, status')
    .eq('user_id', user.id)
    .eq('status', 'matched')
    .not('room_id', 'is', null)
    .order('matched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existingMatch?.room_id) {
    return NextResponse.json({
      status: 'matched',
      roomId: existingMatch.room_id,
      roomUrl: existingMatch.room_url,
    })
  }

  await serviceSupabase.from('queue').delete().eq('user_id', user.id).in('status', ['waiting', 'matching'])

  const queueInsert = await serviceSupabase.from('queue').insert({
    user_id: user.id,
    goal: body.goal?.trim() ?? '',
    duration_minutes: durationMinutes,
    status: 'waiting',
  })

  if (isMissingDurationColumnError(queueInsert.error)) {
    const fallbackInsert = await serviceSupabase.from('queue').insert({
      user_id: user.id,
      goal: body.goal?.trim() ?? '',
      status: 'waiting',
    })

    if (fallbackInsert.error) {
      return NextResponse.json({ error: fallbackInsert.error.message }, { status: 500 })
    }
  } else if (queueInsert.error) {
    return NextResponse.json({ error: queueInsert.error.message }, { status: 500 })
  }

  return NextResponse.json({ status: 'waiting' })
}

export async function GET() {
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

  const claimResult = await serviceSupabase.rpc('claim_match_pair', { p_user_id: user.id })

  let currentQueueId: string | null = null
  let partnerQueueId: string | null = null
  let partnerUserId: string | null = null

  if (claimResult.error) {
    if (!shouldUseLegacyMatchFlow(claimResult.error)) {
      return NextResponse.json({ error: claimResult.error.message }, { status: 500 })
    }

    const legacyState = await getLegacyMatchState(serviceSupabase, user.id)
    if ('roomId' in legacyState) {
      return NextResponse.json({ roomId: legacyState.roomId })
    }

    if (legacyState.status !== 'pair-found') {
      return NextResponse.json({ status: legacyState.status })
    }

    currentQueueId = legacyState.currentId
    partnerQueueId = legacyState.partnerId
    partnerUserId = legacyState.partnerUserId
  } else {
    const claim = (claimResult.data?.[0] ?? null) as MatchClaimRow | null

    if (!claim || claim.status === 'idle') {
      return NextResponse.json({ status: 'idle' })
    }

    if (claim.status === 'matched' && claim.room_id) {
      return NextResponse.json({ roomId: claim.room_id })
    }

    if (claim.status !== 'matching' || !claim.current_queue_id || !claim.partner_queue_id || !claim.partner_user_id) {
      return NextResponse.json({ status: claim.status })
    }

    currentQueueId = claim.current_queue_id
    partnerQueueId = claim.partner_queue_id
    partnerUserId = claim.partner_user_id
  }

  const sharedDuration = LIVE_MATCH_DURATION_MINUTES

  const meetingData = !isDailyConfigured()
    ? buildMockMeeting('Daily is not configured yet, so this session is running in local mock mode.')
    : await createDailyRoom(sharedDuration)
        .then((room) => ({
          roomName: room.name,
          roomUrl: room.url,
          provider: 'daily' as const,
        }))
        .catch((error) => {
          const message = error instanceof Error ? error.message : 'Daily room creation failed.'
          return buildMockMeeting(
            `Daily room creation failed, so this session is running in local mock mode. ${message}`
          )
        })

  const roomId = meetingData.roomName
  const roomUrl = meetingData.roomUrl
  const matchedAt = new Date().toISOString()

  const currentUpdate = await serviceSupabase
    .from('queue')
    .update({
      status: 'matched',
      room_id: roomId,
      room_url: roomUrl,
      duration_minutes: sharedDuration,
      partner_id: partnerUserId,
      matched_at: matchedAt,
    })
    .eq('id', currentQueueId)

  if (isMissingDurationColumnError(currentUpdate.error)) {
    const fallbackCurrentUpdate = await serviceSupabase
      .from('queue')
      .update({
        status: 'matched',
        room_id: roomId,
        room_url: roomUrl,
        partner_id: partnerUserId,
        matched_at: matchedAt,
      })
      .eq('id', currentQueueId)

    if (fallbackCurrentUpdate.error) {
      if (currentQueueId && partnerQueueId) {
        await serviceSupabase
          .from('queue')
          .update({ status: 'waiting', partner_id: null, matched_at: null })
          .in('id', [currentQueueId, partnerQueueId])
          .eq('status', 'matching')
      }
      return NextResponse.json({ error: fallbackCurrentUpdate.error.message }, { status: 500 })
    }
  } else if (currentUpdate.error) {
    if (currentQueueId && partnerQueueId) {
      await serviceSupabase
        .from('queue')
        .update({ status: 'waiting', partner_id: null, matched_at: null })
        .in('id', [currentQueueId, partnerQueueId])
        .eq('status', 'matching')
    }
    return NextResponse.json({ error: currentUpdate.error.message }, { status: 500 })
  }

  const partnerUpdate = await serviceSupabase
    .from('queue')
    .update({
      status: 'matched',
      room_id: roomId,
      room_url: roomUrl,
      duration_minutes: sharedDuration,
      partner_id: user.id,
      matched_at: matchedAt,
    })
    .eq('id', partnerQueueId)

  if (isMissingDurationColumnError(partnerUpdate.error)) {
    const fallbackPartnerUpdate = await serviceSupabase
      .from('queue')
      .update({
        status: 'matched',
        room_id: roomId,
        room_url: roomUrl,
        partner_id: user.id,
        matched_at: matchedAt,
      })
      .eq('id', partnerQueueId)

    if (fallbackPartnerUpdate.error) {
      await serviceSupabase
        .from('queue')
        .update({ status: 'waiting', partner_id: null, matched_at: null, room_id: null, room_url: null })
        .eq('id', partnerQueueId)
      await serviceSupabase
        .from('queue')
        .update({ status: 'waiting', partner_id: null, matched_at: null, room_id: null, room_url: null })
        .eq('id', currentQueueId)
      return NextResponse.json({ error: fallbackPartnerUpdate.error.message }, { status: 500 })
    }
  } else if (partnerUpdate.error) {
    await serviceSupabase
      .from('queue')
      .update({ status: 'waiting', partner_id: null, matched_at: null, room_id: null, room_url: null })
      .eq('id', partnerQueueId)
    await serviceSupabase
      .from('queue')
      .update({ status: 'waiting', partner_id: null, matched_at: null, room_id: null, room_url: null })
      .eq('id', currentQueueId)
    return NextResponse.json({ error: partnerUpdate.error.message }, { status: 500 })
  }

  return NextResponse.json({ roomId })
}
