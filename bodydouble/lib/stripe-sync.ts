import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'

export async function syncUserPlanFromCheckoutSession(sessionId: string) {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    return { ok: false as const, error: 'Missing STRIPE_SECRET_KEY.' }
  }

  const stripe = new Stripe(secretKey)
  const session = await stripe.checkout.sessions.retrieve(sessionId)
  const userId = session.metadata?.userId
  const plan = session.metadata?.plan === 'lifetime' ? 'lifetime' : 'pro'

  if (!userId) {
    return { ok: false as const, error: 'Checkout session is missing a userId.' }
  }

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return { ok: false as const, error: 'Checkout session is not paid yet.' }
  }

  const supabase = createServiceClient()
  await supabase
    .from('users')
    .update({
      plan,
      stripe_customer_id: typeof session.customer === 'string' ? session.customer : null,
    })
    .eq('id', userId)

  return { ok: true as const, plan }
}
