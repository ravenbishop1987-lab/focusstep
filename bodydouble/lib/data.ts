import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getBanMessage, isUserCurrentlyBanned } from '@/lib/moderation'
import { startOfCurrentWeek } from '@/lib/utils'

export async function getCurrentUserProfile() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: profile } = await supabase.from('users').select('*').eq('id', user.id).single()
  return profile
}

export async function requireProfile() {
  const profile = await getCurrentUserProfile()

  if (!profile) {
    redirect('/auth')
  }

  if (isUserCurrentlyBanned(profile)) {
    const message = getBanMessage(profile)
    redirect(message ? `/banned?reason=${encodeURIComponent(message)}` : '/banned')
  }

  return profile
}

export async function requireOnboardedProfile() {
  const profile = await requireProfile()

  if (!profile.onboarding_done) {
    redirect('/onboarding')
  }

  return profile
}

export async function getDashboardData(userId: string) {
  const supabase = createClient()
  const weekStart = startOfCurrentWeek()

  // Month range for calendar
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()

  const [weeklyCountResult, queueHistoryResult, upcomingResult, slotsResult, monthSlotsResult] = await Promise.all([
    supabase
      .from('sessions')
      .select('id', { count: 'exact', head: true })
      .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
      .gte('started_at', weekStart),
    supabase
      .from('queue')
      .select('room_id, partner_id, goal, room_url, joined_at')
      .eq('user_id', userId)
      .not('room_id', 'is', null)
      .order('joined_at', { ascending: false })
      .limit(6),
    supabase
      .from('scheduled_slots')
      .select('*')
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .in('status', ['open', 'claimed'])
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(10),
    supabase
      .from('scheduled_slots')
      .select('*')
      .eq('host_id', userId)
      .eq('status', 'open')
      .order('scheduled_at', { ascending: true })
      .limit(3),
    supabase
      .from('scheduled_slots')
      .select(`
        id,
        scheduled_at,
        duration_minutes,
        goal,
        status,
        host_id,
        guest_id,
        host:users!scheduled_slots_host_id_fkey(id, name),
        guest:users!scheduled_slots_guest_id_fkey(id, name)
      `)
      .or(`host_id.eq.${userId},guest_id.eq.${userId}`)
      .in('status', ['open', 'claimed'])
      .gte('scheduled_at', monthStart)
      .lte('scheduled_at', monthEnd)
      .order('scheduled_at', { ascending: true }),
  ])

  const partnerIds = Array.from(
    new Set(
      (queueHistoryResult.data ?? [])
        .map((entry) => entry.partner_id)
        .filter((partnerId): partnerId is string => Boolean(partnerId))
    )
  )

  const partnerMap = new Map<string, { name: string | null }>()

  if (partnerIds.length) {
    const { data: partners } = await supabase.from('users').select('id, name').in('id', partnerIds)
    partners?.forEach((partner) => partnerMap.set(partner.id, { name: partner.name }))
  }

  const recentHistory = (queueHistoryResult.data ?? []).map((entry) => ({
    ...entry,
    partner_name: entry.partner_id ? partnerMap.get(entry.partner_id)?.name ?? 'Body Double' : 'Body Double',
  }))

  const monthSlots = (monthSlotsResult.data ?? []).map((slot) => ({
    ...slot,
    host: Array.isArray(slot.host) ? slot.host[0] ?? null : slot.host ?? null,
    guest: Array.isArray(slot.guest) ? slot.guest[0] ?? null : slot.guest ?? null,
  }))

  return {
    weeklySessions: weeklyCountResult.count ?? 0,
    upcoming: upcomingResult.data ?? [],
    openHostedSlots: slotsResult.data ?? [],
    recentHistory,
    monthSlots: monthSlots as Array<{
      id: string
      scheduled_at: string
      duration_minutes: number
      goal: string | null
      status: string
      host_id: string
      guest_id: string | null
      host: { id: string; name: string | null } | null
      guest: { id: string; name: string | null } | null
    }>,
  }
}

export async function getSessionRoomData(roomId: string, userId: string) {
  const supabase = createClient()
  const { data: entries } = await supabase
    .from('queue')
    .select('user_id, goal, room_url, partner_id, matched_at, duration_minutes')
    .eq('room_id', roomId)

  const currentEntry = entries?.find((entry) => entry.user_id === userId)
  const partnerEntry = entries?.find((entry) => entry.user_id !== userId)

  let partner = null
  if (partnerEntry?.user_id) {
    const { data } = await supabase.from('users').select('id, name').eq('id', partnerEntry.user_id).single()
    partner = data
  }

  const rawRoomUrl = currentEntry?.room_url ?? partnerEntry?.room_url ?? ''
  const isMockRoom = rawRoomUrl.startsWith('mock://')
  const roomMessage = isMockRoom ? decodeURIComponent(rawRoomUrl.replace('mock://', '')) : ''

  return {
    roomUrl: isMockRoom ? '' : rawRoomUrl,
    roomMessage,
    durationMinutes: currentEntry?.duration_minutes ?? partnerEntry?.duration_minutes ?? 25,
    yourGoal: currentEntry?.goal ?? '',
    partnerGoal: partnerEntry?.goal ?? '',
    partnerId: partner?.id ?? currentEntry?.partner_id ?? partnerEntry?.user_id ?? partnerEntry?.partner_id ?? '',
    partnerName: partner?.name ?? 'your partner',
    matchedAt: currentEntry?.matched_at ?? partnerEntry?.matched_at ?? new Date().toISOString(),
  }
}
