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
    status?: 'reviewed' | 'dismissed'
    reviewNotes?: string
  }

  const status = body.status === 'dismissed' ? 'dismissed' : 'reviewed'
  const reviewNotes = String(body.reviewNotes ?? '').trim().slice(0, 1000)

  const { error } = await serviceSupabase
    .from('user_reports')
    .update({
      status,
      review_notes: reviewNotes,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
