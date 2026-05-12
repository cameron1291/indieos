import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe, PLANS, type PlanKey } from '@/lib/stripe'
import { createServiceClient } from '@/lib/supabase-server'
import type Stripe from 'stripe'

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')

  if (!signature) {
    return NextResponse.json({ error: 'No signature' }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createServiceClient()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const userId = session.metadata?.user_id
    const plan = session.metadata?.plan as PlanKey

    if (!userId || !plan) return NextResponse.json({ received: true })

    await supabase.from('profiles').update({
      plan,
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      subscription_status: 'active',
      apps_limit: PLANS[plan].appsLimit,
    }).eq('id', userId)
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.user_id

    if (!userId) return NextResponse.json({ received: true })

    await supabase.from('profiles').update({
      plan: 'free',
      subscription_status: 'inactive',
      stripe_subscription_id: null,
      apps_limit: 2,
    }).eq('id', userId)
  }

  if (event.type === 'customer.subscription.updated') {
    const sub = event.data.object as Stripe.Subscription
    const userId = sub.metadata?.user_id
    const plan = sub.metadata?.plan as PlanKey

    if (!userId) return NextResponse.json({ received: true })

    await supabase.from('profiles').update({
      subscription_status: sub.status,
      ...(plan && PLANS[plan] ? { plan, apps_limit: PLANS[plan].appsLimit } : {}),
    }).eq('id', userId)
  }

  return NextResponse.json({ received: true })
}
