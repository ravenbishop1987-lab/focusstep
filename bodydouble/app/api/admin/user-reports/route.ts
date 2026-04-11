import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? '')
  .split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean)

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const { data, error } = await serviceSupabase
    .from('user_reports')
    .select(`
      id,
      room_id,
      reason,
      details,
      status,
      created_at,
      reviewed_at,
      review_notes,
      reporter_id,
      reported_user_id,
      reporter:users!user_reports_reporter_id_fkey(id, name, email),
      reported:users!user_reports_reported_user_id_fkey(id, name, email, is_banned, banned_reason, banned_until)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
