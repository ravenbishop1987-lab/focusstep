import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const body = (await request.json().catch(() => ({}))) as {
    reason?: string
    durationDays?: number
  }

  const reason = String(body.reason ?? '').trim().slice(0, 500)
  if (!reason) {
    return NextResponse.json({ error: 'A ban reason is required.' }, { status: 400 })
  }

  const durationDays = Number.isFinite(body.durationDays) ? Math.max(0, Math.round(body.durationDays as number)) : 0
  const bannedUntil = durationDays > 0 ? new Date(Date.now() + durationDays * 86400000).toISOString() : null

  const { error } = await serviceSupabase
    .from('users')
    .update({
      is_banned: true,
      banned_reason: reason,
      banned_at: new Date().toISOString(),
      banned_until: bannedUntil,
    })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await serviceSupabase.from('queue').delete().eq('user_id', params.id)

  return NextResponse.json({ ok: true })
}
