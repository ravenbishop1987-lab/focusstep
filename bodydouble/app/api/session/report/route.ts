import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getBanMessage, getUserModerationState, isUserCurrentlyBanned } from '@/lib/moderation'

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

  const body = (await request.json().catch(() => ({}))) as {
    roomId?: string
    reportedUserId?: string
    reason?: string
    details?: string
  }

  const roomId = String(body.roomId ?? '').trim()
  const reportedUserId = String(body.reportedUserId ?? '').trim()
  const reason = String(body.reason ?? '').trim().slice(0, 120)
  const details = String(body.details ?? '').trim().slice(0, 1000)

  if (!roomId || !reportedUserId || !reason) {
    return NextResponse.json({ error: 'roomId, reportedUserId, and reason are required.' }, { status: 400 })
  }

  if (reportedUserId === user.id) {
    return NextResponse.json({ error: 'You cannot report yourself.' }, { status: 400 })
  }

  const { data: queueEntries } = await serviceSupabase
    .from('queue')
    .select('user_id, room_id, status')
    .eq('room_id', roomId)
    .eq('status', 'matched')

  const isReporterInRoom = queueEntries?.some((entry) => entry.user_id === user.id)
  const isReportedInRoom = queueEntries?.some((entry) => entry.user_id === reportedUserId)

  if (!isReporterInRoom || !isReportedInRoom) {
    return NextResponse.json({ error: 'This report does not match an active session.' }, { status: 403 })
  }

  const { error } = await serviceSupabase.from('user_reports').insert({
    room_id: roomId,
    reporter_id: user.id,
    reported_user_id: reportedUserId,
    reason,
    details,
    status: 'open',
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
