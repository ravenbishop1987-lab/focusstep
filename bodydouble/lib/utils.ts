export function formatGreeting(date = new Date()) {
  const hour = date.getHours()

  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function getInitials(name: string | null | undefined) {
  if (!name) return 'BD'
  const parts = name.split(' ').filter(Boolean)
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'BD'
}

export function formatMinutes(minutes: number | null | undefined) {
  if (!minutes) return '0 min'
  if (minutes < 60) return `${minutes} min`

  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  return remaining ? `${hours}h ${remaining}m` : `${hours}h`
}

export function startOfCurrentWeek() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  now.setHours(0, 0, 0, 0)
  now.setDate(now.getDate() + diff)
  return now.toISOString()
}

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export function buildShareText(minutes: number, streak: number) {
  return `I just focused for ${minutes} minutes with a body double. Streak: ${streak} days.`
}

export function formatDateTime(value: string, timeZone?: string) {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...(timeZone ? { timeZone } : {}),
  }).format(new Date(value))
}

export function zonedDateTimeToUtc(date: string, time: string, timeZone: string) {
  const [year, month, day] = date.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)

  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0))
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })

  const parts = Object.fromEntries(
    formatter.formatToParts(utcGuess).map((part) => [part.type, part.value])
  )

  const zonedInstantAsUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  )

  const intendedInstantAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0)
  const offset = intendedInstantAsUtc - zonedInstantAsUtc

  return new Date(utcGuess.getTime() + offset)
}
