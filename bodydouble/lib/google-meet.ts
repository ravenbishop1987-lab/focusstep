type GoogleTokenResponse = {
  access_token: string
  token_type: string
  expires_in: number
  scope?: string
  refresh_token?: string
}

type GoogleMeetSpace = {
  name: string
  meetingUri: string
  meetingCode?: string
}

type GoogleOAuthState = {
  userId: string
  next?: string
  redirectUri?: string
}

function getGoogleMeetEnv() {
  return {
    clientId: process.env.GOOGLE_MEET_CLIENT_ID,
    clientSecret: process.env.GOOGLE_MEET_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_MEET_REFRESH_TOKEN,
    redirectUri: process.env.GOOGLE_MEET_REDIRECT_URI,
  }
}

export function isGoogleMeetConfigured() {
  const { clientId, clientSecret, refreshToken } = getGoogleMeetEnv()
  return Boolean(clientId && clientSecret && refreshToken)
}

export function isGoogleMeetOAuthConfigured() {
  const { clientId, clientSecret } = getGoogleMeetEnv()
  return Boolean(clientId && clientSecret)
}

export function getGoogleMeetRedirectUri(origin?: string, override?: string) {
  if (override) {
    return override
  }

  const { redirectUri } = getGoogleMeetEnv()
  if (redirectUri) {
    return redirectUri
  }

  if (origin) {
    return `${origin}/api/google/callback`
  }

  throw new Error('Google Meet redirect URI is missing.')
}

export function encodeGoogleOAuthState(state: GoogleOAuthState) {
  return encodeURIComponent(JSON.stringify(state))
}

export function decodeGoogleOAuthState(value: string) {
  return JSON.parse(decodeURIComponent(value)) as GoogleOAuthState
}

export function getGoogleMeetAuthorizeUrl({
  state,
  origin,
  redirectUri,
}: {
  state: string
  origin?: string
  redirectUri?: string
}) {
  const { clientId } = getGoogleMeetEnv()
  const resolvedRedirectUri = getGoogleMeetRedirectUri(origin, redirectUri)

  if (!clientId) {
    throw new Error('Google Meet OAuth env vars are missing.')
  }

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: resolvedRedirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: 'https://www.googleapis.com/auth/meetings.space.created https://www.googleapis.com/auth/userinfo.email',
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

async function getGoogleAccessToken(refreshTokenOverride?: string) {
  const { clientId, clientSecret, refreshToken } = getGoogleMeetEnv()
  const refreshTokenToUse = refreshTokenOverride || refreshToken

  if (!clientId || !clientSecret || !refreshTokenToUse) {
    throw new Error('Google Meet OAuth env vars are missing.')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshTokenToUse,
      grant_type: 'refresh_token',
    }),
  })

  const data = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string }

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Unable to refresh Google access token.')
  }

  return data.access_token
}

export async function exchangeGoogleCodeForTokens(code: string) {
  const { clientId, clientSecret } = getGoogleMeetEnv()
  const redirectUri = getGoogleMeetRedirectUri(undefined)

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Meet OAuth env vars are missing.')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const data = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string }

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Unable to exchange Google authorization code.')
  }

  return data
}

export async function exchangeGoogleCodeForTokensWithRedirect(code: string, redirectUri: string) {
  const { clientId, clientSecret } = getGoogleMeetEnv()

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google Meet OAuth env vars are missing.')
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  const data = (await response.json()) as GoogleTokenResponse & { error?: string; error_description?: string }

  if (!response.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || 'Unable to exchange Google authorization code.')
  }

  return data
}

export async function getGoogleUserEmail(accessToken: string) {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const data = (await response.json()) as { email?: string; error?: { message?: string } }

  if (!response.ok || !data.email) {
    throw new Error(data.error?.message || 'Unable to load Google account email.')
  }

  return data.email
}

export async function createGoogleMeetSpace(refreshTokenOverride?: string) {
  const accessToken = await getGoogleAccessToken(refreshTokenOverride)

  const response = await fetch('https://meet.googleapis.com/v2/spaces', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  })

  const data = (await response.json()) as GoogleMeetSpace & { error?: { message?: string } }

  if (!response.ok || !data.name || !data.meetingUri) {
    throw new Error(data.error?.message || 'Unable to create Google Meet space.')
  }

  return data
}
