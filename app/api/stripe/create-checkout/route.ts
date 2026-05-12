import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { stripe, PLANS, type PlanKey } from '@/lib/stripe'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { plan } = await request.json() as { plan: PlanKey }

  if (!PLANS[plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const { data: profileData } = await supabase
    .from('profiles')
    .select('stripe_customer_id, email')
    .eq('id', user.id)
    .single()
  const profile = profileData as { stripe_customer_id: string | null; email: string | null } | null

  const origin = request.headers.get('origin') ?? 'http://localhost:3000'

  const priceId = PLANS[plan].priceId
  if (!priceId) {
    return NextResponse.json({ error: 'Plan not available — contact support' }, { status: 400 })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      customer: profile?.stripe_customer_id ?? undefined,
      customer_email: profile?.stripe_customer_id ? undefined : (profile?.email ?? user.email),
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/dashboard?upgraded=1`,
      cancel_url: `${origin}/dashboard/settings?tab=billing`,
      metadata: { user_id: user.id, plan },
      subscription_data: { metadata: { user_id: user.id, plan } },
    })
    return NextResponse.json({ url: session.url })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Stripe error'
    console.error('[stripe/create-checkout]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
