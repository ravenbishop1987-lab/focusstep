import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  decodeGoogleOAuthState,
  exchangeGoogleCodeForTokensWithRedirect,
  getGoogleUserEmail,
} from '@/lib/google-meet'

type CallbackState = {
  userId: string
  next?: string
  redirectUri?: string
}

function buildNextRedirect(url: URL, next: string | undefined, key: string, value: string) {
  const destination = new URL(next ?? '/profile', url.origin)
  destination.searchParams.set(key, value)
  return destination
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  let state: CallbackState | null = null
  if (stateParam) {
    try {
      state = decodeGoogleOAuthState(stateParam)
    } catch {
      state = null
    }
  }

  if (error) {
    return NextResponse.redirect(buildNextRedirect(url, state?.next, 'google_error', error))
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(new URL('/profile?google_error=missing_code', url.origin))
  }

  let parsedState: CallbackState
  try {
    parsedState = decodeGoogleOAuthState(stateParam)
  } catch {
    return NextResponse.redirect(new URL('/profile?google_error=bad_state', url.origin))
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user || user.id !== parsedState.userId) {
    return NextResponse.redirect(new URL('/auth', url.origin))
  }

  try {
    const redirectUri = parsedState.redirectUri ?? `${url.origin}/api/google/callback`
    const tokens = await exchangeGoogleCodeForTokensWithRedirect(code, redirectUri)
    const refreshToken = tokens.refresh_token

    if (!refreshToken) {
      return NextResponse.redirect(
        buildNextRedirect(url, parsedState.next, 'google_error', 'missing_refresh_token')
      )
    }

    const email = await getGoogleUserEmail(tokens.access_token)
    const { error: updateError } = await supabase
      .from('users')
      .update({
        google_meet_email: email,
        google_meet_refresh_token: refreshToken,
      })
      .eq('id', user.id)

    if (updateError) {
      throw new Error(updateError.message)
    }

    return NextResponse.redirect(buildNextRedirect(url, parsedState.next, 'google_connected', '1'))
  } catch (callbackError) {
    const message =
      callbackError instanceof Error ? callbackError.message : 'google_connect_failed'

    return NextResponse.redirect(buildNextRedirect(url, parsedState.next, 'google_error', message))
  }
}
