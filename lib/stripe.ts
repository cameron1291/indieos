import Stripe from 'stripe'

export function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2026-04-22.dahlia',
  })
}

// Convenience alias — always call inside a request handler, never at module scope
export const stripe = {
  checkout: { sessions: { create: (...args: Parameters<Stripe['checkout']['sessions']['create']>) => getStripe().checkout.sessions.create(...args) } },
  billingPortal: { sessions: { create: (...args: Parameters<Stripe['billingPortal']['sessions']['create']>) => getStripe().billingPortal.sessions.create(...args) } },
  webhooks: { constructEvent: (...args: Parameters<Stripe['webhooks']['constructEvent']>) => getStripe().webhooks.constructEvent(...args) },
} as const

export const PLANS = {
  solo: {
    name: 'Solo',
    price: 2900, // cents
    priceId: process.env.STRIPE_SOLO_PRICE_ID ?? '',
    appsLimit: 3,
    features: ['3 apps', 'Unlimited opportunities', 'Screenshot generator', 'Icon generator', 'All tools'],
  },
  studio: {
    name: 'Studio',
    price: 7900,
    priceId: process.env.STRIPE_STUDIO_PRICE_ID ?? '',
    appsLimit: -1, // unlimited
    features: ['Unlimited apps', 'Everything in Solo', 'White label reports', 'Priority support'],
  },
} as const

export type PlanKey = keyof typeof PLANS
