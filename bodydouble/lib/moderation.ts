import { createServiceClient } from '@/lib/supabase/server'

type ModerationState = {
  is_banned?: boolean | null
  banned_reason?: string | null
  banned_until?: string | null
}

export function isMissingModerationColumnError(error: { message?: string } | null) {
  const message = error?.message?.toLowerCase() ?? ''
  return (
    message.includes('is_banned') ||
    message.includes('banned_reason') ||
    message.includes('banned_until')
  )
}

export function isUserCurrentlyBanned(state: ModerationState | null | undefined) {
  if (!state?.is_banned) {
    return false
  }

  if (!state.banned_until) {
    return true
  }

  return new Date(state.banned_until).getTime() > Date.now()
}

export function getBanMessage(state: ModerationState | null | undefined) {
  if (!isUserCurrentlyBanned(state)) {
    return ''
  }

  if (state?.banned_reason?.trim()) {
    return state.banned_reason.trim()
  }

  return 'Your account is currently unavailable while a moderation review is in effect.'
}

export async function getUserModerationState(userId: string) {
  const serviceSupabase = createServiceClient()
  const { data, error } = await serviceSupabase
    .from('users')
    .select('is_banned, banned_reason, banned_until')
    .eq('id', userId)
    .maybeSingle()

  if (error && !isMissingModerationColumnError(error)) {
    throw error
  }

  if (error && isMissingModerationColumnError(error)) {
    return {
      is_banned: false,
      banned_reason: null,
      banned_until: null,
    }
  }

  return data ?? {
    is_banned: false,
    banned_reason: null,
    banned_until: null,
  }
}
