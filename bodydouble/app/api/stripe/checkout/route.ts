import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { ensureStripeCatalog, type StripePlanKey } from '@/lib/stripe-catalog'

export const dynamic = 'force-dynamic'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

function isUsableStripePriceId(priceId?: string) {
  return Boolean(priceId && priceId.startsWith('price_') && !priceId.includes('...'))
}

export async function POST(request: Request) {
  if (!stripe) {
    return NextResponse.json({ error: 'Missing STRIPE_SECRET_KEY.' }, { status: 500 })
  }

  const supabase = createClient()
  const serviceSupabase = createServiceClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 })
  }

  const { data: profile } = await serviceSupabase.from('users').select('*').eq('id', user.id).single()
  const body = (await request.json()) as {
    priceId?: string
    planKey?: StripePlanKey
    mode: 'payment' | 'subscription'
  }

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin

  try {
    const catalog = await ensureStripeCatalog(stripe)
    const resolvedPriceId =
      isUsableStripePriceId(body.priceId)
        ? body.priceId!
        : body.planKey === 'pro'
          ? catalog.pro.priceId
          : body.planKey === 'lifetime'
            ? catalog.lifetime.priceId
            : ''

    if (!resolvedPriceId) {
      return NextResponse.json({ error: 'No Stripe price could be resolved.' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.create({
      mode: body.mode,
      customer_email: profile?.email ?? user.email,
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      success_url: `${origin}/billing?success=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing?canceled=1`,
      metadata: {
        userId: user.id,
        plan: body.planKey ?? (body.mode === 'payment' ? 'lifetime' : 'pro'),
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    const message =
      error instanceof Stripe.errors.StripeError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Stripe checkout could not be created.'

    console.error('[stripe checkout] failed to create session', {
      planKey: body.planKey,
      mode: body.mode,
      message,
    })

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
