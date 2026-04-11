import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  encodeGoogleOAuthState,
  getGoogleMeetAuthorizeUrl,
  isGoogleMeetOAuthConfigured,
} from '@/lib/google-meet'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)

  if (!isGoogleMeetOAuthConfigured()) {
    return NextResponse.redirect(new URL('/profile?google_error=oauth_not_configured', request.url))
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/auth', request.url))
  }

  const origin = requestUrl.origin
  const redirectUri = `${origin}/api/google/callback`
  const next = requestUrl.searchParams.get('next') || '/profile'
  const state = encodeGoogleOAuthState({ userId: user.id, next, redirectUri })
  const authorizeUrl = getGoogleMeetAuthorizeUrl({ state, origin, redirectUri })
  return NextResponse.redirect(authorizeUrl)
}
