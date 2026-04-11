import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null

export async function POST(request: Request) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe webhook is not configured.' }, { status: 500 })
  }

  const body = await request.text()
  const signature = headers().get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed.' }, { status: 400 })
  }

  const supabase = createServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.userId
      const plan = session.metadata?.plan === 'lifetime' ? 'lifetime' : 'pro'

      if (userId) {
        await supabase
          .from('users')
          .update({
            plan,
            stripe_customer_id:
              typeof session.customer === 'string' ? session.customer : null,
          })
          .eq('id', userId)
      }
      break
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : ''

      if (!customerId) break

      // Map Stripe subscription status to app plan
      const isActive =
        subscription.status === 'active' || subscription.status === 'trialing'

      if (isActive) {
        await supabase
          .from('users')
          .update({ plan: 'pro' })
          .eq('stripe_customer_id', customerId)
          // Don't downgrade lifetime users
          .neq('plan', 'lifetime')
      } else {
        // canceled, past_due, unpaid → revert to free (unless lifetime)
        await supabase
          .from('users')
          .update({ plan: 'free' })
          .eq('stripe_customer_id', customerId)
          .neq('plan', 'lifetime')
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : ''

      if (customerId) {
        await supabase
          .from('users')
          .update({ plan: 'free' })
          .eq('stripe_customer_id', customerId)
          .neq('plan', 'lifetime')
      }
      break
    }

    case 'invoice.payment_failed': {
      // Optionally log or notify — don't change plan yet, Stripe retries
      break
    }

    default:
      break
  }

  return NextResponse.json({ received: true })
}
