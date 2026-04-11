/**
 * Proxy route — forwards translation API calls to the Task Translator Express service.
 *
 * Handles: POST /api/translate/translate
 *          POST /api/translate/refine
 *          POST /api/translate/help-step
 *          GET  /api/translate/pro-status
 *          POST /api/translate/analytics/page-view
 *          GET  /api/translate/usage
 *          POST /api/translate/user/task-complete
 *          POST /api/translate/user/step-progress
 *
 * Auth: attaches the user's Supabase JWT so the Express service can identify
 * the caller via its existing requireAuth middleware.
 */

import { type NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const TRANSLATE_SERVICE_URL = process.env.TRANSLATE_SERVICE_URL?.replace(/\/$/, '') ?? ''
// Use the shared Supabase service role key as the proxy secret — both services already have it
const PROXY_SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const UPSTREAM_TIMEOUT_MS = 15000

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params.path, 'GET')
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params.path, 'POST')
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params.path, 'PUT')
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyRequest(req, params.path, 'DELETE')
}

async function proxyRequest(req: NextRequest, pathSegments: string[], method: string) {
  if (!TRANSLATE_SERVICE_URL) {
    return NextResponse.json(
      { error: 'Translation service is not configured.' },
      { status: 503 }
    )
  }

  // Get session and user plan from bodydouble's own auth/DB
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let userPlan = 'free'
  if (user) {
    const service = createServiceClient()
    const { data: profile } = await service
      .from('users')
      .select('plan')
      .eq('id', user.id)
      .maybeSingle()
    userPlan = profile?.plan ?? 'free'
  }

  const { data: { session } } = await supabase.auth.getSession()

  const upstreamPath = pathSegments.join('/')
  const upstreamUrl = `${TRANSLATE_SERVICE_URL}/${upstreamPath}`

  const headers = new Headers()
  const contentType = req.headers.get('content-type')
  if (contentType) {
    headers.set('content-type', contentType)
  }
  if (session?.access_token) {
    headers.set('authorization', `Bearer ${session.access_token}`)
  }
  // Forward the verified plan so the translator backend can skip its own DB lookup
  if (PROXY_SECRET) {
    headers.set('x-proxy-secret', PROXY_SECRET)
    headers.set('x-user-plan', userPlan)
  }
  // Forward real IP for rate limiting
  const ip = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip')
  if (ip) headers.set('x-forwarded-for', ip)

  const body = ['POST', 'PUT', 'PATCH'].includes(method) ? await req.text() : undefined
  const abortController = new AbortController()
  const timeoutId = setTimeout(() => abortController.abort(), UPSTREAM_TIMEOUT_MS)

  try {
    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body,
      signal: abortController.signal,
    })
    const responseText = await upstream.text()
    const upstreamContentType = upstream.headers.get('content-type') ?? ''

    if (upstream.ok) {
      return new NextResponse(responseText, {
        status: upstream.status,
        headers: { 'content-type': upstreamContentType || 'application/json' },
      })
    }

    const renderRequestId =
      upstream.headers.get('x-render-request-id')
      ?? upstream.headers.get('x-request-id')
      ?? undefined

    if (upstreamContentType.includes('application/json')) {
      return new NextResponse(responseText, {
        status: upstream.status,
        headers: { 'content-type': upstreamContentType },
      })
    }

    const fallbackMessage = upstream.status === 429
      ? 'The translation service is rate limiting requests right now. Please wait a moment and try again.'
      : upstream.status >= 500
        ? 'The translation service is temporarily unavailable.'
        : `The translation service returned ${upstream.status}.`

    return NextResponse.json(
      {
        error: fallbackMessage,
        upstreamStatus: upstream.status,
        requestId: renderRequestId,
      },
      { status: upstream.status }
    )
  } catch (err) {
    console.error('[translate proxy] upstream error:', err)
    const timedOut = err instanceof Error && err.name === 'AbortError'
    return NextResponse.json(
      { error: timedOut ? 'Translation service timed out.' : 'Translation service unavailable.' },
      { status: 502 }
    )
  } finally {
    clearTimeout(timeoutId)
  }
}
