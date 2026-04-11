import { NextResponse } from 'next/server'
import { createDailyRoom, isDailyConfigured } from '@/lib/daily'

function buildMockRoom(message: string) {
  return {
    roomName: `local-${crypto.randomUUID()}`,
    roomUrl: `mock://${encodeURIComponent(message)}`,
    provider: 'mock' as const,
    message,
  }
}

export async function POST() {
  if (!isDailyConfigured()) {
    return NextResponse.json(
      buildMockRoom('Daily is not configured yet, so this session is running in local mock mode.')
    )
  }

  try {
    const room = await createDailyRoom()

    return NextResponse.json({
      roomName: room.name,
      roomUrl: room.url,
      provider: 'daily',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create Daily room.'

    return NextResponse.json(
      buildMockRoom(`Daily failed, so this session is running in local mock mode. ${message}`)
    )
  }
}
