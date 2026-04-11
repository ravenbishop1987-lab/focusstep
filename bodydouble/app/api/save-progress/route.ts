import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()

  const body = (await request.json().catch(() => ({}))) as {
    email?: string
    task?: string
    stepsCompleted?: number
  }

  const email = String(body.email ?? '').trim().slice(0, 255) || null
  const task = String(body.task ?? '').trim().slice(0, 1000) || null
  const stepsCompleted = typeof body.stepsCompleted === 'number' ? Math.max(0, Math.floor(body.stepsCompleted)) : null

  if (!task) {
    return NextResponse.json({ error: 'task is required' }, { status: 400 })
  }

  const payload: Record<string, unknown> = {
    task,
    steps_completed: stepsCompleted,
    saved_at: new Date().toISOString(),
  }

  if (user) payload.user_id = user.id
  if (email) payload.email = email

  try {
    const { error } = await serviceSupabase.from('user_progress').insert(payload)
    if (error) {
      console.error('[save-progress] supabase error', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[save-progress] unexpected error', err)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
