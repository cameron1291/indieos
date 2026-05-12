'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Rocket, ArrowRight, Check, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = ['Welcome', 'Your app', 'Your goals', 'Done']

const GOAL_OPTIONS = [
  { id: 'users', label: 'Get first users', desc: 'Find people talking about your problem online' },
  { id: 'aso', label: 'Rank on App Store', desc: 'Optimise listing for search' },
  { id: 'validate', label: 'Validate an idea', desc: "Test before you build" },
  { id: 'launch', label: 'Prepare for launch', desc: 'Screenshots, icons, legal docs' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [appName, setAppName] = useState('')
  const [description, setDescription] = useState('')
  const [platform, setPlatform] = useState<'ios' | 'android' | 'both'>('both')
  const [goals, setGoals] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  function toggleGoal(id: string) {
    setGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id])
  }

  async function finish() {
    if (!appName.trim()) { toast.error('Enter your app name'); return }
    setSaving(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      await supabase.from('apps').insert({
        user_id: user.id,
        name: appName,
        description,
        platform,
        tone: 'helpful',
        keywords: [],
        high_intent_phrases: [],
        penalty_keywords: [],
        boost_keywords: [],
        reddit_subreddits: [],
        facebook_groups: [],
        min_score: 8,
        monitoring_active: false,
      })

      await supabase.from('profiles').update({ onboarding_completed: true }).eq('id', user.id)

      router.push('/dashboard')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-4 text-white">
      {/* Progress */}
      <div className="mb-10 flex items-center gap-2">
        {STEPS.map((label, i) => {
          const done = i < step
          const active = i === step
          return (
            <div key={i} className="flex items-center gap-2">
              <div className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                done ? 'bg-violet-600' : active ? 'bg-violet-600' : 'bg-zinc-800 text-zinc-500'
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </div>
              <span className={cn('text-sm hidden sm:block', active ? 'font-medium' : 'text-zinc-500')}>{label}</span>
              {i < STEPS.length - 1 && <div className="h-px w-8 bg-zinc-800" />}
            </div>
          )
        })}
      </div>

      <div className="w-full max-w-md">

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600">
              <Rocket className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Welcome to IndieOS</h1>
              <p className="mt-3 text-zinc-400">Let&apos;s set up your first app in 2 minutes. You can add more later.</p>
            </div>
            <Button onClick={() => setStep(1)} className="w-full bg-violet-600 hover:bg-violet-500" size="lg">
              Get started <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 1: App details */}
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">Tell us about your app</h2>
              <p className="mt-1.5 text-zinc-400">This helps us tailor the growth engine and prep tools for you.</p>
            </div>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-zinc-300">App name</Label>
                <Input
                  placeholder="e.g. InvoiceQuick"
                  value={appName}
                  onChange={e => setAppName(e.target.value)}
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">What does it do? <span className="text-zinc-500 font-normal">(optional)</span></Label>
                <Textarea
                  placeholder="e.g. Helps Australian tradies create invoices from voice memos in under 30 seconds"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  rows={3}
                  className="bg-zinc-900 border-zinc-700 text-white placeholder:text-zinc-600"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-zinc-300">Platform</Label>
                <div className="flex gap-2">
                  {(['ios', 'android', 'both'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={cn(
                        'flex-1 rounded-lg border py-2 text-sm font-medium capitalize transition-colors',
                        platform === p ? 'border-violet-500 bg-violet-950/40 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                      )}
                    >
                      {p === 'both' ? 'Both' : p === 'ios' ? 'iOS' : 'Android'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 flex-1">Back</Button>
              <Button onClick={() => setStep(2)} disabled={!appName.trim()} className="bg-violet-600 hover:bg-violet-500 flex-1">
                Continue <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Goals */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold">What&apos;s your main goal?</h2>
              <p className="mt-1.5 text-zinc-400">Select all that apply — we&apos;ll show the right tools first.</p>
            </div>
            <div className="space-y-2">
              {GOAL_OPTIONS.map(g => (
                <button
                  key={g.id}
                  onClick={() => toggleGoal(g.id)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors',
                    goals.includes(g.id) ? 'border-violet-500 bg-violet-950/30' : 'border-zinc-800 hover:border-zinc-700'
                  )}
                >
                  <div className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors',
                    goals.includes(g.id) ? 'border-violet-500 bg-violet-600' : 'border-zinc-600'
                  )}>
                    {goals.includes(g.id) && <Check className="h-3 w-3" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{g.label}</p>
                    <p className="text-xs text-zinc-500">{g.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 flex-1">Back</Button>
              <Button onClick={finish} disabled={saving} className="bg-violet-600 hover:bg-violet-500 flex-1">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {saving ? 'Setting up…' : 'Go to dashboard'}
              </Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
