import Link from 'next/link'
import { Rocket, TrendingUp, PackageOpen, BarChart2, FlaskConical, Search, ArrowRight, Check } from 'lucide-react'

const FEATURES = [
  {
    icon: TrendingUp,
    title: 'Growth Engine',
    desc: 'Automated Reddit & Facebook scanning finds people asking for exactly what your app does. AI-scored leads, draft replies, post with one click.',
  },
  {
    icon: PackageOpen,
    title: 'App Store Prep',
    desc: 'AI listing writer, keyword research, screenshot composer, icon generator, legal docs — everything you need to ship, in one place.',
  },
  {
    icon: BarChart2,
    title: 'Downloads dashboard',
    desc: 'Connect App Store Connect and Google Play. See downloads, revenue, and top countries in one dashboard — no spreadsheets.',
  },
  {
    icon: FlaskConical,
    title: 'Pressure tester',
    desc: 'Paste your idea and get a brutally honest market analysis: size, competition, monetisation, go-to-market, and a BUILD / PIVOT / DONT_BUILD verdict in seconds.',
  },
  {
    icon: Search,
    title: 'Name & domain checker',
    desc: 'Check 10 app names at once. Instant domain availability across .com, .app, .io, .co plus direct App Store and Play Store search.',
  },
  {
    icon: Rocket,
    title: 'Launch checklist',
    desc: 'Every iOS and Android submission requirement tracked. Never miss a step — privacy policy, screenshots, export compliance and more.',
  },
]

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    features: ['1 app', '50 opportunities/mo', 'Listing writer', 'Legal doc generator', 'Submission checklist'],
    cta: 'Get started free',
    href: '/signup',
    highlight: false,
  },
  {
    name: 'Solo',
    price: '$29',
    period: 'per month',
    features: ['3 apps', 'Unlimited opportunities', 'All prep tools', 'Downloads dashboard', 'Icon & screenshot generator', 'Priority support'],
    cta: 'Start Solo',
    href: '/signup?plan=solo',
    highlight: true,
  },
  {
    name: 'Studio',
    price: '$79',
    period: 'per month',
    features: ['Unlimited apps', 'Everything in Solo', 'API access', 'White-label reports', 'Dedicated support'],
    cta: 'Start Studio',
    href: '/signup?plan=studio',
    highlight: false,
  },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-violet-400" />
          <span className="font-bold text-lg tracking-tight">LaunchPad</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-zinc-400 hover:text-white transition-colors">Sign in</Link>
          <Link href="/signup" className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium hover:bg-violet-500 transition-colors">
            Get started free
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-800 bg-violet-950/50 px-3 py-1 text-xs text-violet-300">
          <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-pulse" />
          Built for indie app developers
        </div>
        <h1 className="text-5xl font-bold tracking-tight sm:text-6xl">
          Launch your app<br />
          <span className="bg-gradient-to-r from-violet-400 to-pink-400 bg-clip-text text-transparent">faster than you think</span>
        </h1>
        <p className="mt-6 text-xl text-zinc-400 max-w-2xl mx-auto leading-relaxed">
          LaunchPad handles everything from validating your idea to finding your first users — so you can spend more time building and less time on everything else.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/signup" className="flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3.5 text-base font-semibold hover:bg-violet-500 transition-colors">
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">
            See what&apos;s included ↓
          </Link>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold">Everything in one place</h2>
          <p className="mt-3 text-zinc-400">Stop juggling 12 different tools. LaunchPad has everything an indie dev needs.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 hover:border-zinc-700 transition-colors">
              <div className="mb-3 inline-flex rounded-lg bg-violet-900/40 p-2.5">
                <Icon className="h-5 w-5 text-violet-400" />
              </div>
              <h3 className="font-semibold">{title}</h3>
              <p className="mt-2 text-sm text-zinc-400 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-5xl px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold">Simple pricing</h2>
          <p className="mt-3 text-zinc-400">No hidden fees. Cancel any time.</p>
        </div>
        <div className="grid gap-6 sm:grid-cols-3">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-6 flex flex-col ${plan.highlight ? 'border-violet-500 bg-violet-950/30' : 'border-zinc-800 bg-zinc-900'}`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-xs font-semibold">
                  Most popular
                </div>
              )}
              <div>
                <p className="font-semibold text-sm text-zinc-400">{plan.name}</p>
                <p className="mt-1 text-4xl font-bold">{plan.price}<span className="text-lg font-normal text-zinc-400"> / {plan.period}</span></p>
              </div>
              <ul className="mt-6 space-y-2.5 flex-1">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-300">
                    <Check className="h-4 w-4 shrink-0 mt-0.5 text-green-400" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={plan.href}
                className={`mt-8 block rounded-xl py-2.5 text-center text-sm font-semibold transition-colors ${plan.highlight ? 'bg-violet-600 hover:bg-violet-500 text-white' : 'border border-zinc-700 hover:border-zinc-500 text-zinc-200'}`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Footer CTA */}
      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold">Ready to launch?</h2>
        <p className="mt-4 text-zinc-400">Join indie developers who use LaunchPad to ship faster and grow smarter.</p>
        <Link href="/signup" className="mt-8 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-8 py-3.5 text-base font-semibold hover:bg-violet-500 transition-colors">
          Get started free <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-8">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-zinc-500">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-violet-400" />
            <span>LaunchPad</span>
          </div>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-zinc-300 transition-colors">Sign in</Link>
            <Link href="/signup" className="hover:text-zinc-300 transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
