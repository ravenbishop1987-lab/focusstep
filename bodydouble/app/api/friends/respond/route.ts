import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getBanMessage, getUserModerationState, isUserCurrentlyBanned } from '@/lib/moderation'

export const dynamic = 'force-dynamic'

// PATCH — accept or decline a pending friend request
export async function PATCH(request: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const moderationState = await getUserModerationState(user.id)
  if (isUserCurrentlyBanned(moderationState)) return NextResponse.json({ error: getBanMessage(moderationState) }, { status: 403 })

  const { rowId, action } = (await request.json()) as {
    rowId: string
    action: 'accept' | 'decline'
  }

  if (!rowId || !['accept', 'decline'].includes(action)) {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const service = createServiceClient()

  // Only the recipient (friend_id) can respond
  const { data: row } = await service
    .from('friends')
    .select('id, friend_id, status')
    .eq('id', rowId)
    .single()

  if (!row) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
  if (row.friend_id !== user.id) return NextResponse.json({ error: 'Not authorised.' }, { status: 403 })
  if (row.status !== 'pending') return NextResponse.json({ error: 'Request already resolved.' }, { status: 409 })

  await service
    .from('friends')
    .update({ status: action === 'accept' ? 'accepted' : 'declined' })
    .eq('id', rowId)

  return NextResponse.json({ ok: true })
}
