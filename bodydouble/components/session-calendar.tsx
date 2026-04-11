'use client'

import { useState } from 'react'
import Link from 'next/link'

type Slot = {
  id: string
  scheduled_at: string
  duration_minutes: number
  goal: string | null
  status: string
  host_id: string
  guest_id: string | null
  host: { id: string; name: string | null } | null
  guest: { id: string; name: string | null } | null
}

type Props = {
  slots: Slot[]
  userId: string
  isPaid: boolean
  timeZone: string
  initialTodayIso: string
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

function formatWeekdayDate(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone,
  }).format(new Date(iso))
}

export function SessionCalendar({ slots, userId, isPaid, timeZone, initialTodayIso }: Props) {
  const today = startOfDay(new Date(initialTodayIso))
  const [viewDate, setViewDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selected, setSelected] = useState<Date | null>(today)

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  const startOffset = (firstDay.getDay() + 6) % 7
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7

  const cells: (Date | null)[] = Array.from({ length: totalCells }, (_, i) => {
    const d = i - startOffset + 1
    if (d < 1 || d > lastDay.getDate()) return null
    return new Date(year, month, d)
  })

  const slotDaySet = new Set(
    slots.map((s) => {
      const d = new Date(s.scheduled_at)
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    })
  )

  function hasSlot(date: Date) {
    return slotDaySet.has(`${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`)
  }

  const selectedSlots = selected ? slots.filter((s) => isSameDay(new Date(s.scheduled_at), selected)) : []

  const now = new Date(initialTodayIso)
  const upcoming = slots.filter((s) => new Date(s.scheduled_at) >= now).slice(0, 5)

  function prevMonth() {
    setViewDate(new Date(year, month - 1, 1))
  }

  function nextMonth() {
    setViewDate(new Date(year, month + 1, 1))
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '0.5px solid var(--bdc)',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p className="section-label">Session calendar</p>
          <p style={{ fontSize: 15, fontWeight: 700, fontFamily: 'Georgia, serif', color: 'var(--ink)', marginTop: 2 }}>
            {MONTH_NAMES[month]} {year}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={prevMonth}
            type="button"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--bg)',
              border: '0.5px solid var(--bdc)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              fontSize: 14,
            }}
          >
            {'<'}
          </button>
          <button
            onClick={() => {
              setViewDate(new Date(today.getFullYear(), today.getMonth(), 1))
              setSelected(today)
            }}
            type="button"
            style={{
              height: 32,
              padding: '0 10px',
              borderRadius: 8,
              background: 'var(--bg)',
              border: '0.5px solid var(--bdc)',
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 500,
              color: 'var(--muted)',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            Today
          </button>
          <button
            onClick={nextMonth}
            type="button"
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'var(--bg)',
              border: '0.5px solid var(--bdc)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted)',
              fontSize: 14,
            }}
          >
            {'>'}
          </button>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_240px]">
        <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--bdc)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 8 }}>
            {DAY_LABELS.map((d) => (
              <div
                key={d}
                style={{
                  textAlign: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--faint)',
                  paddingBottom: 6,
                }}
              >
                {d}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
            {cells.map((date, i) => {
              if (!date) return <div key={`empty-${i}`} />

              const isToday = isSameDay(date, today)
              const isSelected = selected ? isSameDay(date, selected) : false
              const isPast = date < today && !isToday
              const hasDot = hasSlot(date)

              return (
                <button
                  key={date.toISOString()}
                  onClick={() => setSelected(date)}
                  type="button"
                  style={{
                    position: 'relative',
                    aspectRatio: '1',
                    borderRadius: 8,
                    border: isSelected
                      ? '1.5px solid var(--accent)'
                      : isToday
                        ? '1.5px solid var(--accent-border)'
                        : '0.5px solid transparent',
                    background: isSelected ? 'var(--chip)' : isToday ? 'var(--subtle)' : 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    padding: '4px 2px',
                    transition: 'background 0.1s, border-color 0.1s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg)'
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected && !isToday) e.currentTarget.style.background = 'transparent'
                    if (isToday && !isSelected) e.currentTarget.style.background = 'var(--subtle)'
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isToday || isSelected ? 700 : 400,
                      color: isSelected ? 'var(--accent-dark)' : isToday ? 'var(--accent)' : isPast ? 'var(--faint)' : 'var(--body)',
                      lineHeight: 1,
                      fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                  >
                    {date.getDate()}
                  </span>
                  {hasDot ? (
                    <span
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: '50%',
                        background: isSelected ? 'var(--accent)' : 'var(--accent-border)',
                        display: 'block',
                        flexShrink: 0,
                      }}
                    />
                  ) : null}
                </button>
              )
            })}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              marginTop: 14,
              paddingTop: 12,
              borderTop: '0.5px solid var(--bdc)',
              fontSize: 11,
              color: 'var(--faint)',
              flexWrap: 'wrap',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent-border)', display: 'inline-block' }} />
              Session scheduled
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  border: '1.5px solid var(--accent-border)',
                  background: 'var(--subtle)',
                  display: 'inline-block',
                }}
              />
              Today
            </span>
          </div>
        </div>

        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {selected ? (
            <>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                {formatWeekdayDate(selected.toISOString(), timeZone)}
              </p>

              {selectedSlots.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedSlots.map((slot) => (
                    <SessionSlotCard key={slot.id} slot={slot} timeZone={timeZone} userId={userId} />
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 10,
                    minHeight: 100,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 20 }}>○</div>
                  <p style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.5 }}>No sessions on this day.</p>
                  {isPaid ? (
                    <Link
                      href="/schedule"
                      style={{
                        fontSize: 12,
                        color: 'var(--accent)',
                        textDecoration: 'underline',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                      }}
                    >
                      {'Schedule one ->'}
                    </Link>
                  ) : null}
                </div>
              )}
            </>
          ) : null}

          {upcoming.length > 0 ? (
            <>
              <div style={{ height: '0.5px', background: 'var(--bdc)', margin: '4px 0' }} />
              <p style={{ fontSize: 10, fontWeight: 600, color: 'var(--faint)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Upcoming
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {upcoming.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => {
                      const d = startOfDay(new Date(slot.scheduled_at))
                      setViewDate(new Date(d.getFullYear(), d.getMonth(), 1))
                      setSelected(d)
                    }}
                    type="button"
                    style={{
                      textAlign: 'left',
                      background: 'var(--bg)',
                      border: '0.5px solid var(--bdc)',
                      borderRadius: 8,
                      padding: '8px 10px',
                      cursor: 'pointer',
                      width: '100%',
                    }}
                  >
                    <p style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, marginBottom: 2 }}>
                      {formatTime(slot.scheduled_at, timeZone)} · {slot.duration_minutes} min
                    </p>
                    <p
                      style={{
                        fontSize: 12,
                        color: 'var(--body)',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {slot.goal || 'Focus session'}
                    </p>
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {!isPaid && slots.length === 0 ? (
            <div
              style={{
                background: 'var(--subtle)',
                border: '0.5px solid var(--accent-light)',
                borderRadius: 10,
                padding: '12px 12px',
                fontSize: 12,
                color: 'var(--accent-dark)',
                lineHeight: 1.5,
              }}
            >
              Scheduling is a Pro feature. Upgrade to book sessions in advance.
              <br />
              <Link href="/billing" style={{ color: 'var(--accent)', fontWeight: 600, textDecoration: 'underline' }}>
                {'Upgrade ->'}
              </Link>
            </div>
          ) : null}

          <Link
            href="/schedule"
            style={{
              display: 'block',
              textAlign: 'center',
              background: 'transparent',
              border: '0.5px solid var(--bdm)',
              borderRadius: 20,
              padding: '7px 0',
              fontSize: 12,
              color: 'var(--muted)',
              textDecoration: 'none',
              marginTop: 'auto',
              fontFamily: 'system-ui, -apple-system, sans-serif',
            }}
          >
            {'Open scheduling ->'}
          </Link>
        </div>
      </div>
    </div>
  )
}

function SessionSlotCard({ slot, userId, timeZone }: { slot: Slot; userId: string; timeZone: string }) {
  const isHost = slot.host_id === userId
  const isClaimed = slot.status === 'claimed'
  const otherPersonName = isHost ? slot.guest?.name ?? (slot.guest_id ? 'your guest' : 'a guest') : slot.host?.name ?? 'your host'
  const introText = isClaimed
    ? isHost
      ? `You'll be focusing with ${otherPersonName}.`
      : `${otherPersonName} is hosting this session with you.`
    : 'This session is still open and waiting for someone to claim it.'

  return (
    <div
      style={{
        borderLeft: '3px solid var(--accent)',
        borderRadius: '0 8px 8px 0',
        borderTop: '0.5px solid var(--bdc)',
        borderRight: '0.5px solid var(--bdc)',
        borderBottom: '0.5px solid var(--bdc)',
        background: 'var(--card)',
        padding: '10px 12px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)', fontFamily: 'system-ui' }}>
          {formatTime(slot.scheduled_at, timeZone)}
        </p>
        <span
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: isClaimed ? 'var(--accent-dark)' : 'var(--muted)',
            background: isClaimed ? 'var(--chip)' : 'var(--bg)',
            border: `0.5px solid ${isClaimed ? 'var(--accent-border)' : 'var(--bdc)'}`,
            borderRadius: 20,
            padding: '1px 7px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {isClaimed ? 'Confirmed' : 'Open'}
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--body)', marginBottom: 2 }}>{slot.goal || 'Focus session'}</p>
      <p style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.5, marginBottom: 4 }}>{introText}</p>
      <p style={{ fontSize: 11, color: 'var(--faint)' }}>{slot.duration_minutes} min · {isHost ? 'You hosting' : 'Guest spot'}</p>
    </div>
  )
}
