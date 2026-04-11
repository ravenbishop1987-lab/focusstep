import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendReminderEmail, sendWeeklySummaryEmail } from '@/lib/email'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const oneWeekAgo = new Date(Date.now() - 7 * 86400000).toISOString()
  const reminderWindowStart = new Date(Date.now() + 14 * 60000).toISOString()
  const reminderWindowEnd = new Date(Date.now() + 16 * 60000).toISOString()

  const [{ data: users }, { data: soonSlots }] = await Promise.all([
    supabase.from('users').select('*'),
    supabase
      .from('scheduled_slots')
      .select('*, host:users!scheduled_slots_host_id_fkey(email), guest:users!scheduled_slots_guest_id_fkey(email)')
      .eq('status', 'claimed')
      .gte('scheduled_at', reminderWindowStart)
      .lte('scheduled_at', reminderWindowEnd),
  ])

  for (const user of users ?? []) {
    const { data: sessions } = await supabase
      .from('sessions')
      .select('duration_minutes')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
      .gte('started_at', oneWeekAgo)

    const totalMinutes = (sessions ?? []).reduce((sum, session) => sum + (session.duration_minutes ?? 0), 0)
    await sendWeeklySummaryEmail(user.email, user.name ?? 'there', sessions?.length ?? 0, totalMinutes, user.streak ?? 0)
  }

  for (const slot of soonSlots ?? []) {
    if (slot.host?.email) {
      await sendReminderEmail(slot.host.email, slot.scheduled_at, slot.goal ?? '')
    }
    if (slot.guest?.email) {
      await sendReminderEmail(slot.guest.email, slot.scheduled_at, slot.goal ?? '')
    }
  }

  return NextResponse.json({ ok: true })
}
