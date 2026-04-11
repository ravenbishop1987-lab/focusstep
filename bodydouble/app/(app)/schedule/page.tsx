import { ScheduleClient } from '@/components/schedule-client'
import { claimScheduledSlot, createScheduledSlot, removeScheduledSlot } from '@/lib/actions'
import { requireOnboardedProfile } from '@/lib/data'
import { createClient } from '@/lib/supabase/server'
import { getPlanDurationOptions } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'

export default async function SchedulePage() {
  const profile = await requireOnboardedProfile()
  const supabase = createClient()
  const allowedDurations = getPlanDurationOptions(profile.plan)

  const { data: slots } = await supabase
    .from('scheduled_slots')
    .select('*, host:users!scheduled_slots_host_id_fkey(id, name, timezone, focus_types)')
    .eq('status', 'open')
    .neq('host_id', profile.id)
    .order('scheduled_at', { ascending: true })

  const { data: yourSlots } = await supabase
    .from('scheduled_slots')
    .select('*, host:users!scheduled_slots_host_id_fkey(id, name), guest:users!scheduled_slots_guest_id_fkey(id, name)')
    .or(`host_id.eq.${profile.id},guest_id.eq.${profile.id}`)
    .in('status', ['open', 'claimed'])
    .order('scheduled_at', { ascending: true })

  const matchingSlots = (slots ?? []).filter((slot) => {
    const hostFocusTypes = slot.host?.focus_types ?? []
    return !hostFocusTypes.length || hostFocusTypes.some((value: string) => profile.focus_types?.includes(value))
  })
  const fallbackSlots = (slots ?? []).filter((slot) => !matchingSlots.some((match) => match.id === slot.id))
  const normalizedYourSlots = (yourSlots ?? []).map((slot) => ({
    ...slot,
    host: Array.isArray(slot.host) ? slot.host[0] ?? null : slot.host ?? null,
    guest: Array.isArray(slot.guest) ? slot.guest[0] ?? null : slot.guest ?? null,
  }))

  return (
    <div className="page-shell">
      <div className="mx-auto grid max-w-[1120px] gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <form action={createScheduledSlot} className="card space-y-4">
          <div>
            <p className="section-label mb-3">Post an open slot</p>
            <h1 className="text-[30px] leading-tight">Offer a future session.</h1>
            <p className="mt-2 text-[13px] text-ink-muted">Times are posted in your timezone: {profile.timezone || 'UTC'}.</p>
          </div>
          <ScheduleClient defaultDate={new Date().toISOString().slice(0, 10)} />
          <div>
            <label className="section-label mb-2 block">Duration</label>
            <div className="flex flex-wrap gap-3">
              {allowedDurations.map((value, index) => (
                <label className="inline-flex cursor-pointer items-center" key={value}>
                  <input className="peer sr-only" defaultChecked={index === 0} name="duration" type="radio" value={value} />
                  <span className="chip inline-flex items-center peer-checked:chip-selected">
                    {value} min
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="section-label mb-2 block">Goal</label>
            <textarea className="input min-h-[100px]" name="goal" placeholder="What will this session support?" />
          </div>
          <button className="btn-primary w-full" disabled={profile.plan === 'free'} type="submit">
            Post this slot
          </button>
        </form>

        <section className="space-y-4">
          <div>
            <p className="section-label mb-3">Browse open slots</p>
            <h2 className="text-[30px] leading-tight">Sessions that fit your focus preferences.</h2>
          </div>
          {normalizedYourSlots.length ? (
            <div className="card space-y-3">
              <div>
                <p className="section-label mb-2">Your scheduled entries</p>
                <p className="text-[13px] text-ink-muted">You can remove an open slot you posted or leave a claimed slot if plans change.</p>
              </div>
              {normalizedYourSlots.map((slot) => {
                const isHost = slot.host_id === profile.id
                const otherName = isHost ? slot.guest?.name ?? 'No guest yet' : slot.host?.name ?? 'Host'

                return (
                  <div className="upcoming-session-card" key={slot.id}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-[14px] text-ink">
                          {formatDateTime(slot.scheduled_at, profile.timezone || 'UTC')}
                        </p>
                        <p className="text-[13px] text-ink-muted">
                          {slot.goal || 'Quiet accountability session'}
                        </p>
                        <p className="mt-1 text-[13px] text-ink-muted">
                          {slot.duration_minutes} min · {isHost ? (slot.status === 'claimed' ? `Hosted with ${otherName}` : 'You are hosting') : `Claimed with ${otherName}`}
                        </p>
                      </div>
                      <form action={removeScheduledSlot}>
                        <input name="slot_id" type="hidden" value={slot.id} />
                        <button className="btn-ghost" type="submit">
                          {isHost ? 'Remove slot' : 'Leave slot'}
                        </button>
                      </form>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : null}
          {profile.plan === 'free' ? (
            <div className="banner text-[13px]">Scheduling is a Pro feature. You can still explore the flow here and upgrade on billing.</div>
          ) : null}
          <div className="space-y-3">
            {matchingSlots.length ? (
              matchingSlots.map((slot) => (
                <form action={claimScheduledSlot} className="upcoming-session-card" key={slot.id}>
                  <input name="slot_id" type="hidden" value={slot.id} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] text-ink">{slot.host?.name ?? 'Host'}</p>
                      <p className="text-[13px] text-ink-muted">{formatDateTime(slot.scheduled_at, profile.timezone || 'UTC')}</p>
                      <p className="mt-1 text-[13px] text-ink-muted">{slot.goal || 'Quiet accountability session'}</p>
                    </div>
                    <button className="btn-ghost" disabled={profile.plan === 'free'} type="submit">
                      Claim slot
                    </button>
                  </div>
                </form>
              ))
            ) : (
              <div className="card text-[13px] text-ink-muted">
                No open slots match your focus preferences yet. You can still browse other open sessions below or post one to help the next person find you.
              </div>
            )}
          </div>

          {fallbackSlots.length ? (
            <div className="space-y-3">
              <div>
                <p className="section-label mb-3">All open slots</p>
                <h3 className="text-[22px] leading-tight">Other sessions you can still claim.</h3>
              </div>
              {fallbackSlots.map((slot) => (
                <form action={claimScheduledSlot} className="upcoming-session-card" key={slot.id}>
                  <input name="slot_id" type="hidden" value={slot.id} />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[14px] text-ink">{slot.host?.name ?? 'Host'}</p>
                      <p className="text-[13px] text-ink-muted">{formatDateTime(slot.scheduled_at, profile.timezone || 'UTC')}</p>
                      <p className="mt-1 text-[13px] text-ink-muted">{slot.goal || 'Quiet accountability session'}</p>
                    </div>
                    <button className="btn-ghost" disabled={profile.plan === 'free'} type="submit">
                      Claim slot
                    </button>
                  </div>
                </form>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  )
}
