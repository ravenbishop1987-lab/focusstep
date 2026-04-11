'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DURATION_OPTIONS, getPlanDurationOptions } from '@/lib/constants'
import { sendScheduledConfirmationEmail } from '@/lib/email'
import { zonedDateTimeToUtc } from '@/lib/utils'

export async function updateProfile(formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const name     = String(formData.get('name') ?? '').trim()
  const timezone = String(formData.get('timezone') ?? 'UTC')
  const adhdType = String(formData.get('adhd_type') ?? '')
  const focusTypes   = formData.getAll('focus_types').map(String)
  const availability = formData.getAll('availability').map(String)

  await supabase
    .from('users')
    .update({ name, timezone, adhd_type: adhdType, focus_types: focusTypes, availability })
    .eq('id', user.id)

  redirect('/profile?saved=1')
}

export async function saveOnboarding(formData: FormData) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const name = String(formData.get('name') ?? '').trim()
  const timezone = String(formData.get('timezone') ?? 'UTC')
  const adhdType = String(formData.get('adhd_type') ?? '')
  const focusTypes = formData.getAll('focus_types').map(String)
  const availability = formData.getAll('availability').map(String)

  await supabase
    .from('users')
    .upsert({
      id: user.id,
      email: user.email!,
      name,
      timezone,
      adhd_type: adhdType || 'Not sure',
      focus_types: focusTypes,
      availability,
      onboarding_done: true,
    })

  redirect('/dashboard')
}

export async function createScheduledSlot(formData: FormData) {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const date = String(formData.get('date') ?? '')
  const time = String(formData.get('time') ?? '')
  const goal = String(formData.get('goal') ?? '').trim()
  const duration = Number(formData.get('duration') ?? 25)
  const { data: profile } = await serviceSupabase.from('users').select('plan, timezone').eq('id', user.id).single()
  const allowedDurations = getPlanDurationOptions(profile?.plan)

  if (
    !DURATION_OPTIONS.includes(duration as (typeof DURATION_OPTIONS)[number]) ||
    !allowedDurations.includes(duration as (typeof DURATION_OPTIONS)[number])
  ) {
    return
  }

  if (!date || !time) {
    return
  }

  const scheduledAt = zonedDateTimeToUtc(date, time, profile?.timezone ?? 'UTC')

  if (Number.isNaN(scheduledAt.getTime()) || scheduledAt <= new Date()) {
    return
  }

  await supabase.from('scheduled_slots').insert({
    host_id: user.id,
    scheduled_at: scheduledAt.toISOString(),
    duration_minutes: duration,
    goal,
  })

  revalidatePath('/schedule')
  revalidatePath('/dashboard')
}

export async function claimScheduledSlot(formData: FormData) {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const { data: profile } = await serviceSupabase.from('users').select('plan').eq('id', user.id).single()
  if (profile?.plan === 'free') {
    return
  }

  const slotId = String(formData.get('slot_id') ?? '')

  const { data: slot } = await serviceSupabase
    .from('scheduled_slots')
    .select('*, host:users!scheduled_slots_host_id_fkey(id, email, name)')
    .eq('id', slotId)
    .single()

  if (!slot || slot.status !== 'open' || slot.host_id === user.id) {
    return
  }

  await serviceSupabase
    .from('scheduled_slots')
    .update({
      guest_id: user.id,
      status: 'claimed',
    })
    .eq('id', slotId)

  const { data: guest } = await serviceSupabase.from('users').select('email, name').eq('id', user.id).single()

  if (slot.host?.email && guest?.email) {
    await sendScheduledConfirmationEmail({
      hostEmail: slot.host.email,
      hostName: slot.host.name ?? 'there',
      guestEmail: guest.email,
      guestName: guest.name ?? 'your guest',
      scheduledAt: slot.scheduled_at,
      durationMinutes: slot.duration_minutes,
      goal: slot.goal ?? '',
    })
  }

  revalidatePath('/schedule')
  revalidatePath('/dashboard')
}

export async function removeScheduledSlot(formData: FormData) {
  const supabase = createClient()
  const serviceSupabase = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth')
  }

  const slotId = String(formData.get('slot_id') ?? '')
  if (!slotId) {
    return
  }

  const { data: slot } = await serviceSupabase
    .from('scheduled_slots')
    .select('id, host_id, guest_id, status')
    .eq('id', slotId)
    .single()

  if (!slot) {
    return
  }

  if (slot.host_id === user.id) {
    await serviceSupabase.from('scheduled_slots').delete().eq('id', slotId)
  } else if (slot.guest_id === user.id && slot.status === 'claimed') {
    await serviceSupabase
      .from('scheduled_slots')
      .update({ guest_id: null, status: 'open' })
      .eq('id', slotId)
  }

  revalidatePath('/schedule')
  revalidatePath('/dashboard')
}
