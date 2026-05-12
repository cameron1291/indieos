'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Loader2, Plus, Wand2 } from 'lucide-react'

const TONE_OPTIONS = [
  { value: 'casual and helpful', label: 'Casual & helpful' },
  { value: 'professional and direct', label: 'Professional & direct' },
  { value: 'technical and precise', label: 'Technical & precise' },
]

interface FormData {
  // Step 1
  name: string
  description: string
  platform: 'ios' | 'android' | 'both'
  app_store_url: string
  play_store_url: string
  website_url: string
  bundle_id: string
  // Step 2
  target_user: string
  problem_solved: string
  tone: string
  // Step 3
  keywords: string[]
  high_intent_phrases: string[]
  penalty_keywords: string[]
  boost_keywords: string[]
  reddit_subreddits: string[]
  facebook_groups: string[]
}

const INITIAL: FormData = {
  name: '', description: '', platform: 'both',
  app_store_url: '', play_store_url: '', website_url: '', bundle_id: '',
  target_user: '', problem_solved: '', tone: 'casual and helpful',
  keywords: [], high_intent_phrases: [], penalty_keywords: [],
  boost_keywords: [], reddit_subreddits: [], facebook_groups: [],
}

function TagInput({ label, values, onChange, placeholder }: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  function add() {
    const val = input.trim()
    if (val && !values.includes(val)) {
      onChange([...values, val])
    }
    setInput('')
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder={placeholder ?? 'Type and press Enter'}
          className="flex-1"
        />
        <Button type="button" variant="outline" size="icon" onClick={add}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {values.map(v => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {v}
              <button onClick={() => onChange(values.filter(x => x !== v))} className="ml-0.5 hover:text-red-500">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewAppPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [data, setData] = useState<FormData>(INITIAL)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  function update(partial: Partial<FormData>) {
    setData(prev => ({ ...prev, ...partial }))
  }

  async function generateConfig() {
    setGenerating(true)
    try {
      const res = await fetch('/api/apps/generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          target_user: data.target_user,
          problem_solved: data.problem_solved,
          platform: data.platform,
        }),
      })
      if (!res.ok) throw new Error('Generation failed')
      const config = await res.json()
      update({
        keywords: config.keywords ?? [],
        high_intent_phrases: config.high_intent_phrases ?? [],
        penalty_keywords: config.penalty_keywords ?? [],
        boost_keywords: config.boost_keywords ?? [],
        reddit_subreddits: config.reddit_subreddits ?? [],
        tone: config.tone ?? data.tone,
      })
      toast.success('Config generated — review and edit before saving')
    } catch {
      toast.error('Failed to generate config. Please fill in manually.')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: app, error } = await supabase.from('apps').insert({
      user_id: user.id,
      name: data.name,
      description: data.description || null,
      target_user: data.target_user || null,
      problem_solved: data.problem_solved || null,
      tone: data.tone,
      app_store_url: data.app_store_url || null,
      play_store_url: data.play_store_url || null,
      website_url: data.website_url || null,
      bundle_id: data.bundle_id || null,
      platform: data.platform,
      keywords: data.keywords,
      high_intent_phrases: data.high_intent_phrases,
      penalty_keywords: data.penalty_keywords,
      boost_keywords: data.boost_keywords,
      reddit_subreddits: data.reddit_subreddits,
      facebook_groups: data.facebook_groups,
    }).select().single()

    if (error) {
      toast.error(error.message)
      setSaving(false)
      return
    }

    toast.success('App created!')
    router.push(`/dashboard/apps/${app.id}/settings`)
    router.refresh()
  }

  const STEPS = [
    'App basics',
    'Target audience',
    'Monitoring setup',
    'Facebook groups',
  ]

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Add your app</h1>
        <p className="mt-1 text-sm text-zinc-500">Step {step} of {STEPS.length} — {STEPS[step - 1]}</p>
        <Progress value={(step / STEPS.length) * 100} className="mt-3 h-1.5" />
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* ── Step 1 ── */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">App name *</Label>
                <Input id="name" value={data.name} onChange={e => update({ name: e.target.value })} required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="desc">Description</Label>
                <Textarea
                  id="desc"
                  rows={3}
                  placeholder="What does your app do in 1-2 sentences?"
                  value={data.description}
                  onChange={e => update({ description: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Platform</Label>
                <div className="flex gap-2">
                  {(['ios', 'android', 'both'] as const).map(p => (
                    <Button
                      key={p}
                      type="button"
                      variant={data.platform === p ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => update({ platform: p })}
                    >
                      {p === 'both' ? 'Both' : p === 'ios' ? 'iOS' : 'Android'}
                    </Button>
                  ))}
                </div>
              </div>
              {(data.platform === 'ios' || data.platform === 'both') && (
                <div className="space-y-1.5">
                  <Label htmlFor="ios-url">App Store URL</Label>
                  <Input id="ios-url" type="url" value={data.app_store_url} onChange={e => update({ app_store_url: e.target.value })} placeholder="https://apps.apple.com/…" />
                </div>
              )}
              {(data.platform === 'android' || data.platform === 'both') && (
                <div className="space-y-1.5">
                  <Label htmlFor="play-url">Google Play URL</Label>
                  <Input id="play-url" type="url" value={data.play_store_url} onChange={e => update({ play_store_url: e.target.value })} placeholder="https://play.google.com/…" />
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="website">Website URL</Label>
                  <Input id="website" type="url" value={data.website_url} onChange={e => update({ website_url: e.target.value })} placeholder="https://yourapp.com" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bundle">Bundle ID</Label>
                  <Input id="bundle" value={data.bundle_id} onChange={e => update({ bundle_id: e.target.value })} placeholder="com.company.app" />
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="target">Target user</Label>
                <Input
                  id="target"
                  value={data.target_user}
                  onChange={e => update({ target_user: e.target.value })}
                  placeholder="e.g. Freelance tradies who invoice clients"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="problem">Problem solved</Label>
                <Textarea
                  id="problem"
                  rows={3}
                  value={data.problem_solved}
                  onChange={e => update({ problem_solved: e.target.value })}
                  placeholder="e.g. Time wasted creating invoices manually in spreadsheets"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Reply tone</Label>
                <div className="flex flex-wrap gap-2">
                  {TONE_OPTIONS.map(opt => (
                    <Button
                      key={opt.value}
                      type="button"
                      variant={data.tone === opt.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => update({ tone: opt.value })}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3 ── */}
          {step === 3 && (
            <div className="space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">Monitoring keywords</p>
                  <p className="text-sm text-zinc-500">
                    AI-generated based on your app details. Edit as needed.
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateConfig}
                  disabled={generating}
                >
                  {generating ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wand2 className="mr-2 h-3.5 w-3.5" />
                  )}
                  {generating ? 'Generating…' : 'Generate with AI'}
                </Button>
              </div>
              <TagInput label="Keywords" values={data.keywords} onChange={v => update({ keywords: v })} placeholder="e.g. invoice app for tradies" />
              <TagInput label="High intent phrases" values={data.high_intent_phrases} onChange={v => update({ high_intent_phrases: v })} placeholder="e.g. looking for invoice app" />
              <TagInput label="Penalty keywords (always reject)" values={data.penalty_keywords} onChange={v => update({ penalty_keywords: v })} placeholder="e.g. hiring, job description" />
              <TagInput label="Boost keywords (score booster)" values={data.boost_keywords} onChange={v => update({ boost_keywords: v })} placeholder="e.g. recommend, which app" />
              <TagInput label="Reddit subreddits (without r/)" values={data.reddit_subreddits} onChange={v => update({ reddit_subreddits: v })} placeholder="e.g. smallbusiness" />
            </div>
          )}

          {/* ── Step 4 ── */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                Join these groups in Facebook first, then add them here. The crawler only reads groups you are a member of.
              </div>
              <TagInput
                label="Facebook group URLs"
                values={data.facebook_groups}
                onChange={v => update({ facebook_groups: v })}
                placeholder="https://www.facebook.com/groups/…"
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 flex justify-between">
        <Button
          variant="outline"
          onClick={() => setStep(s => Math.max(1, s - 1))}
          disabled={step === 1}
        >
          Back
        </Button>
        {step < STEPS.length ? (
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={step === 1 && !data.name}
          >
            Continue
          </Button>
        ) : (
          <Button onClick={handleSave} disabled={saving || !data.name}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {saving ? 'Saving…' : 'Save app'}
          </Button>
        )}
      </div>
    </div>
  )
}
