import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getBanMessage, getUserModerationState, isUserCurrentlyBanned } from '@/lib/moderation'

export const dynamic = 'force-dynamic'

// GET — list accepted friends + pending incoming requests
export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const moderationState = await getUserModerationState(user.id)
  if (isUserCurrentlyBanned(moderationState)) return NextResponse.json({ error: getBanMessage(moderationState) }, { status: 403 })

  const service = createServiceClient()

  // All rows where I am either side
  const { data: rows } = await service
    .from('friends')
    .select('id, user_id, friend_id, status, created_at')
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (!rows) return NextResponse.json({ friends: [], pending: [], sent: [] })

  // Collect all other user IDs to fetch names in one query
  const otherIds = Array.from(
    new Set(rows.map((r) => r.user_id === user.id ? r.friend_id : r.user_id))
  )

  const { data: profiles } = otherIds.length
    ? await service.from('users').select('id, name, email, focus_types').in('id', otherIds)
    : { data: [] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const friends = rows
    .filter((r) => r.status === 'accepted')
    .map((r) => {
      const otherId = r.user_id === user.id ? r.friend_id : r.user_id
      return { rowId: r.id, ...profileMap.get(otherId) }
    })

  const acceptedFriendIds = Array.from(
    new Set(
      rows
        .filter((r) => r.status === 'accepted')
        .map((r) => (r.user_id === user.id ? r.friend_id : r.user_id))
    )
  )

  const pending = rows
    .filter((r) => r.status === 'pending' && r.friend_id === user.id)
    .map((r) => ({ rowId: r.id, ...profileMap.get(r.user_id) }))

  const sent = rows
    .filter((r) => r.status === 'pending' && r.user_id === user.id)
    .map((r) => ({ rowId: r.id, ...profileMap.get(r.friend_id) }))

  const { data: activeQueueRows } = acceptedFriendIds.length
    ? await service
        .from('queue')
        .select('room_id, room_url, partner_id, matched_at, goal')
        .eq('user_id', user.id)
        .eq('status', 'matched')
        .not('room_id', 'is', null)
        .in('partner_id', acceptedFriendIds)
        .order('matched_at', { ascending: false })
    : { data: [] }

  const activeSessions = (activeQueueRows ?? []).map((row) => {
    const partner = row.partner_id ? profileMap.get(row.partner_id) : null
    return {
      roomId: row.room_id,
      roomUrl: row.room_url,
      partnerId: row.partner_id,
      partnerName: partner?.name ?? partner?.email ?? 'Your friend',
      partnerEmail: partner?.email ?? '',
      matchedAt: row.matched_at,
      goal: row.goal ?? '',
    }
  })

  return NextResponse.json({ friends, pending, sent, activeSessions })
}

// POST — send a friend request by email
export async function POST(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const moderationState = await getUserModerationState(user.id)
  if (isUserCurrentlyBanned(moderationState)) return NextResponse.json({ error: getBanMessage(moderationState) }, { status: 403 })

  const { email, userId } = (await request.json()) as { email?: string; userId?: string }
  if (!email?.trim() && !userId?.trim()) {
    return NextResponse.json({ error: 'Email or userId is required.' }, { status: 400 })
  }

  const service = createServiceClient()

  const targetQuery = service.from('users').select('id, name, email')
  const { data: target } = userId?.trim()
    ? await targetQuery.eq('id', userId.trim()).single()
    : await targetQuery.eq('email', email!.trim().toLowerCase()).single()

  if (!target) return NextResponse.json({ error: 'No account found with that email.' }, { status: 404 })
  if (target.id === user.id) return NextResponse.json({ error: 'You can\'t add yourself.' }, { status: 400 })

  // Check if relationship already exists in either direction
  const { data: existing } = await service
    .from('friends')
    .select('id, status')
    .or(
      `and(user_id.eq.${user.id},friend_id.eq.${target.id}),and(user_id.eq.${target.id},friend_id.eq.${user.id})`
    )
    .maybeSingle()

  if (existing) {
    const msg =
      existing.status === 'accepted' ? 'You\'re already friends.' :
      existing.status === 'pending'  ? 'A request is already pending.' :
      'This person declined a previous request.'
    return NextResponse.json({ error: msg }, { status: 409 })
  }

  const { error } = await service
    .from('friends')
    .insert({ user_id: user.id, friend_id: target.id, status: 'pending' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, name: target.name, email: target.email, userId: target.id })
}

// DELETE — remove a friendship or cancel/decline a request
export async function DELETE(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const moderationState = await getUserModerationState(user.id)
  if (isUserCurrentlyBanned(moderationState)) return NextResponse.json({ error: getBanMessage(moderationState) }, { status: 403 })

  const { rowId } = (await request.json()) as { rowId: string }
  if (!rowId) return NextResponse.json({ error: 'rowId is required.' }, { status: 400 })

  const service = createServiceClient()
  await service
    .from('friends')
    .delete()
    .eq('id', rowId)
    .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)

  return NextResponse.json({ ok: true })
}
