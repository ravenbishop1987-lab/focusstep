type DailyRoomResponse = {
  name: string
  url: string
}

const DEFAULT_SESSION_DURATION_MINUTES = 25
const ROOM_EXPIRY_BUFFER_MINUTES = 5

function getDailyApiKey() {
  return process.env.DAILY_API_KEY
}

export function isDailyConfigured() {
  return Boolean(getDailyApiKey())
}

export async function createDailyRoom(durationMinutes = DEFAULT_SESSION_DURATION_MINUTES) {
  const apiKey = getDailyApiKey()

  if (!apiKey) {
    throw new Error('Daily API key is missing.')
  }

  const safeDurationMinutes = Math.max(1, durationMinutes)
  const expiresAt =
    Math.floor(Date.now() / 1000) + (safeDurationMinutes + ROOM_EXPIRY_BUFFER_MINUTES) * 60

  const response = await fetch('https://api.daily.co/v1/rooms', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      privacy: 'public',
      properties: {
        exp: expiresAt,
        eject_at_room_exp: true,
        enable_people_ui: true,
      },
    }),
  })

  const data = (await response.json()) as DailyRoomResponse & {
    error?: string
    info?: string
  }

  if (!response.ok || !data.name || !data.url) {
    throw new Error(data.info || data.error || 'Unable to create Daily room.')
  }

  return data
}
