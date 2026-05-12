'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CreditCard, ExternalLink, Check } from 'lucide-react'
import type { Profile } from '@/types/database'

const PLANS = [
  {
    id: 'free',
    label: 'Free',
    price: '$0/mo',
    features: ['1 app', '50 opportunities/mo', 'Listing writer', 'Legal docs'],
  },
  {
    id: 'solo',
    label: 'Solo',
    price: '$29/mo',
    features: ['3 apps', 'Unlimited opportunities', 'All prep tools', 'Downloads dashboard', 'Priority support'],
  },
  {
    id: 'studio',
    label: 'Studio',
    price: '$79/mo',
    features: ['Unlimited apps', 'Unlimited opportunities', 'Everything in Solo', 'API access', 'White-label reports'],
  },
]

export default function SettingsPage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [loadingPortal, setLoadingPortal] = useState(false)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      createClient().from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        if (data) {
          setProfile(data as Profile)
          setFullName((data as Profile).full_name ?? '')
        }
      })
    })
  }, [])

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    const { error } = await createClient().from('profiles').update({ full_name: fullName }).eq('id', profile.id)
    if (error) toast.error('Failed to save')
    else toast.success('Saved')
    setSaving(false)
  }

  async function upgrade(planId: string) {
    setUpgrading(planId)
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planId }),
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      toast.error('Failed to start checkout')
    } finally {
      setUpgrading(null)
    }
  }

  async function openBillingPortal() {
    setLoadingPortal(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch {
      toast.error('Failed to open billing portal')
    } finally {
      setLoadingPortal(false)
    }
  }

  if (!profile) return (
    <div className="flex items-center justify-center p-16">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
    </div>
  )

  const currentPlanIdx = PLANS.findIndex(p => p.id === profile.plan)

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      {/* Profile */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Full name</Label>
            <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" className="max-w-sm" />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input value={profile.email ?? ''} disabled className="max-w-sm bg-zinc-50 dark:bg-zinc-900" />
          </div>
          <Button onClick={saveProfile} disabled={saving} size="sm">
            {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
            Save changes
          </Button>
        </CardContent>
      </Card>

      {/* Plan */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Plan</CardTitle>
              <CardDescription>Current plan: <span className="capitalize font-medium text-zinc-900 dark:text-zinc-100">{profile.plan}</span></CardDescription>
            </div>
            {profile.plan !== 'free' && (
              <Button size="sm" variant="outline" onClick={openBillingPortal} disabled={loadingPortal}>
                {loadingPortal ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <CreditCard className="mr-2 h-3.5 w-3.5" />}
                Manage billing
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            {PLANS.map((plan, idx) => {
              const isCurrent = plan.id === profile.plan
              const isDowngrade = idx < currentPlanIdx

              return (
                <div
                  key={plan.id}
                  className={`rounded-xl border p-4 ${isCurrent ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30' : 'border-zinc-200 dark:border-zinc-800'}`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{plan.label}</p>
                      <p className="text-xl font-bold mt-0.5">{plan.price}</p>
                    </div>
                    {isCurrent && <Badge className="bg-violet-600 text-white text-xs">Current</Badge>}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-start gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <Check className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-500" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && !isDowngrade && (
                    <Button
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => upgrade(plan.id)}
                      disabled={!!upgrading}
                    >
                      {upgrading === plan.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
                      Upgrade
                    </Button>
                  )}
                  {isDowngrade && !isCurrent && (
                    <p className="mt-4 text-center text-xs text-zinc-400">Downgrade via billing portal</p>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* API integrations info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Integrations</CardTitle>
          <CardDescription>Configure these in your .env.local file</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[
              { label: 'App Store Connect', vars: ['APP_STORE_CONNECT_KEY_ID', 'APP_STORE_CONNECT_ISSUER_ID', 'APP_STORE_CONNECT_PRIVATE_KEY'], docs: 'https://developer.apple.com/documentation/appstoreconnectapi' },
              { label: 'Google Play', vars: ['GOOGLE_PLAY_SERVICE_ACCOUNT_JSON'], docs: 'https://developers.google.com/android-publisher' },
              { label: 'Replicate (Icons)', vars: ['REPLICATE_API_TOKEN'], docs: 'https://replicate.com/docs' },
              { label: 'Resend (Email)', vars: ['RESEND_API_KEY'], docs: 'https://resend.com/docs' },
            ].map(({ label, vars, docs }) => (
              <div key={label} className="flex items-start justify-between rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {vars.map(v => (
                      <code key={v} className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">{v}</code>
                    ))}
                  </div>
                </div>
                <a href={docs} target="_blank" rel="noopener noreferrer" className="text-xs text-violet-600 hover:underline flex items-center gap-0.5">
                  Docs <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
