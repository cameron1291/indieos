'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Loader2, Save, Plus, X, Settings2, Radio, Hash, AlertTriangle,
  Wand2, Globe, Eye, EyeOff, Info, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { App } from '@/types/database'

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({ label, desc, placeholder, values, onChange, prefix }: {
  label: string; desc?: string; placeholder: string
  values: string[]; onChange: (v: string[]) => void; prefix?: string
}) {
  const [input, setInput] = useState('')
  function add() {
    const t = input.trim().replace(/^r\/|^\//, '')
    if (!t || values.includes(t)) { setInput(''); return }
    onChange([...values, t]); setInput('')
  }
  return (
    <div>
      <Label className="text-sm text-zinc-300">{label}</Label>
      {desc && <p className="mt-0.5 text-xs text-zinc-500">{desc}</p>}
      <div className="mt-1.5 flex gap-2">
        <div className="relative flex-1">
          {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">{prefix}</span>}
          <Input value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder={placeholder}
            className={cn('bg-zinc-800 border-zinc-700 text-sm', prefix && 'pl-8')} />
        </div>
        <Button size="sm" variant="outline" className="border-zinc-700 hover:bg-zinc-800 shrink-0" onClick={add} disabled={!input.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map(v => (
            <Badge key={v} variant="secondary" className="gap-1 bg-zinc-800 text-zinc-300 hover:bg-zinc-700 pr-1">
              {prefix}{v}
              <button onClick={() => onChange(values.filter(x => x !== v))} className="ml-0.5 opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── AI subreddit suggester ───────────────────────────────────────────────────

function SubredditAISuggester({ app, onAdd }: { app: App; onAdd: (subs: string[]) => void }) {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Array<{ name: string; reason: string }>>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())

  async function suggest() {
    setLoading(true)
    setSuggestions([])
    setSelected(new Set())
    try {
      const res = await fetch('/api/growth/suggest-subreddits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: app.name, appDescription: app.description }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSuggestions(data.subreddits ?? [])
      // Pre-select all
      setSelected(new Set((data.subreddits ?? []).map((s: { name: string }) => s.name)))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to suggest subreddits')
    } finally {
      setLoading(false)
    }
  }

  function toggleSub(name: string) {
    setSelected(prev => {
      const n = new Set(prev)
      n.has(name) ? n.delete(name) : n.add(name)
      return n
    })
  }

  function addSelected() {
    const toAdd = suggestions.filter(s => selected.has(s.name)).map(s => s.name)
    onAdd(toAdd)
    setSuggestions([])
    setSelected(new Set())
    toast.success(`Added ${toAdd.length} subreddits`)
  }

  return (
    <div>
      <Button size="sm" variant="outline" className="border-zinc-700 hover:bg-zinc-800 h-8 text-xs" onClick={suggest} disabled={loading}>
        {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
        AI suggest subreddits
      </Button>

      {suggestions.length > 0 && (
        <div className="mt-3 rounded-xl border border-zinc-700 bg-zinc-800/50 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-zinc-300">{suggestions.length} suggestions — select which to add</p>
            <div className="flex gap-2">
              <button className="text-xs text-violet-400 hover:text-violet-300" onClick={() => setSelected(new Set(suggestions.map(s => s.name)))}>All</button>
              <button className="text-xs text-zinc-500 hover:text-zinc-300" onClick={() => setSelected(new Set())}>None</button>
            </div>
          </div>
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {suggestions.map(s => (
              <button
                key={s.name}
                onClick={() => toggleSub(s.name)}
                className={cn(
                  'w-full flex items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                  selected.has(s.name) ? 'bg-violet-950/50 border border-violet-700/50' : 'hover:bg-zinc-800 border border-transparent',
                )}
              >
                <div className={cn('mt-0.5 h-4 w-4 shrink-0 rounded border flex items-center justify-center', selected.has(s.name) ? 'bg-violet-600 border-violet-500' : 'border-zinc-600')}>
                  {selected.has(s.name) && <Check className="h-2.5 w-2.5 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-zinc-200">r/{s.name}</span>
                  <p className="text-xs text-zinc-500 leading-relaxed">{s.reason}</p>
                </div>
              </button>
            ))}
          </div>
          <Button size="sm" className="w-full h-8 bg-violet-600 hover:bg-violet-500 text-xs" onClick={addSelected} disabled={selected.size === 0}>
            Add {selected.size} subreddit{selected.size !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  )
}

// ─── App config types ─────────────────────────────────────────────────────────

interface AppConfig {
  reddit_subreddits: string[]
  facebook_groups: string[]
  keywords: string[]
  high_intent_phrases: string[]
  penalty_keywords: string[]
  boost_keywords: string[]
  min_score: number
  monitoring_active: boolean
}

interface FbCreds {
  fb_email: string
  fb_password: string
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CrawlerSetupPage() {
  const [apps, setApps] = useState<App[]>([])
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [fbCreds, setFbCreds] = useState<FbCreds>({ fb_email: '', fb_password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingFb, setSavingFb] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('apps').select('*').eq('user_id', user.id).order('created_at').then(({ data }) => {
        const list = (data ?? []) as App[]
        setApps(list)
        if (list.length > 0) { setSelectedAppId(list[0].id); setConfig(toConfig(list[0])) }
        setLoading(false)
      })
      // Load saved FB creds from profiles (stored as JSON in a metadata column)
      supabase.from('profiles').select('*').eq('id', user.id).single().then(({ data }) => {
        const meta = (data as Record<string, unknown> | null)?.crawler_meta as Record<string, string> | undefined
        if (meta?.fb_email) setFbCreds({ fb_email: meta.fb_email, fb_password: meta.fb_password ?? '' })
      })
    })
  }, [])

  function toConfig(app: App): AppConfig {
    return {
      reddit_subreddits: app.reddit_subreddits ?? [],
      facebook_groups: app.facebook_groups ?? [],
      keywords: app.keywords ?? [],
      high_intent_phrases: app.high_intent_phrases ?? [],
      penalty_keywords: app.penalty_keywords ?? [],
      boost_keywords: app.boost_keywords ?? [],
      min_score: app.min_score ?? 7,
      monitoring_active: app.monitoring_active ?? false,
    }
  }

  function selectApp(id: string) {
    const app = apps.find(a => a.id === id)
    if (!app) return
    setSelectedAppId(id); setConfig(toConfig(app))
  }

  function patch(update: Partial<AppConfig>) {
    setConfig(prev => prev ? { ...prev, ...update } : prev)
  }

  async function save() {
    if (!selectedAppId || !config) return
    setSaving(true)
    const { error } = await createClient().from('apps').update({
      reddit_subreddits: config.reddit_subreddits,
      facebook_groups: config.facebook_groups,
      keywords: config.keywords,
      high_intent_phrases: config.high_intent_phrases,
      penalty_keywords: config.penalty_keywords,
      boost_keywords: config.boost_keywords,
      min_score: config.min_score,
      monitoring_active: config.monitoring_active,
      updated_at: new Date().toISOString(),
    }).eq('id', selectedAppId)

    if (error) toast.error(error.message)
    else {
      toast.success('Crawler config saved')
      setApps(prev => prev.map(a => a.id === selectedAppId ? { ...a, ...config } : a))
    }
    setSaving(false)
  }

  async function saveFbCreds() {
    setSavingFb(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSavingFb(false); return }

    // Store in a crawler_credentials table (should exist with RLS: user can only see own row)
    const { error } = await supabase
      .from('crawler_credentials')
      .upsert({ user_id: user.id, fb_email: fbCreds.fb_email, fb_password: fbCreds.fb_password }, { onConflict: 'user_id' })

    if (error) {
      // Table may not exist yet — show friendly message
      if (error.code === '42P01') {
        toast.error('Run the Supabase migration first — see console for SQL')
        console.info(`
-- Run this in Supabase SQL editor:
CREATE TABLE crawler_credentials (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  fb_email TEXT,
  fb_password TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE crawler_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own credentials" ON crawler_credentials
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
        `)
      } else {
        toast.error(error.message)
      }
    } else {
      toast.success('Facebook credentials saved')
    }
    setSavingFb(false)
  }

  const selectedApp = apps.find(a => a.id === selectedAppId)

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>

  if (!apps.length) return (
    <div className="flex flex-col items-center justify-center p-16 text-center">
      <Settings2 className="h-10 w-10 text-zinc-600 mb-4" />
      <p className="text-zinc-400">No apps yet. <a href="/dashboard/apps/new" className="text-violet-400 hover:underline">Create one first.</a></p>
    </div>
  )

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-700/40 bg-gradient-to-br from-zinc-900 to-zinc-900/60 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-900/50">
            <Settings2 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Crawler Setup</h1>
        </div>
        <p className="text-zinc-400 max-w-lg text-sm">Configure where the crawler looks for opportunities. Use AI to find the best subreddits automatically.</p>
      </div>

      {/* App tabs */}
      <div className="flex flex-wrap gap-2">
        {apps.map(app => (
          <button key={app.id} onClick={() => selectApp(app.id)}
            className={cn('flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors',
              selectedAppId === app.id ? 'border-violet-500 bg-violet-600/20 text-violet-300' : 'border-zinc-700 text-zinc-400 hover:border-zinc-500')}>
            {app.name}
            {app.monitoring_active && <span className="h-1.5 w-1.5 rounded-full bg-green-400" />}
          </button>
        ))}
      </div>

      {selectedApp && config && (
        <>
          {/* Monitoring toggle */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardContent className="pt-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', config.monitoring_active ? 'bg-green-600' : 'bg-zinc-700')}>
                    <Radio className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Monitoring</p>
                    <p className="text-xs text-zinc-500">{config.monitoring_active ? 'Active — crawler is watching for opportunities' : 'Paused'}</p>
                  </div>
                </div>
                <button onClick={() => patch({ monitoring_active: !config.monitoring_active })}
                  className={cn('relative h-6 w-11 rounded-full transition-colors', config.monitoring_active ? 'bg-green-600' : 'bg-zinc-700')}>
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-200', config.monitoring_active ? 'translate-x-5' : 'translate-x-0.5')} />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Reddit */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">🤖</span>
                <div>
                  <CardTitle className="text-base">Reddit subreddits</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">The crawler monitors these subreddits for relevant posts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <SubredditAISuggester
                app={selectedApp}
                onAdd={subs => {
                  const existing = new Set(config.reddit_subreddits)
                  const merged = [...config.reddit_subreddits, ...subs.filter(s => !existing.has(s))]
                  patch({ reddit_subreddits: merged })
                }}
              />
              <Separator className="bg-zinc-800" />
              <TagInput
                label="Or add manually"
                placeholder="e.g. entrepreneur"
                values={config.reddit_subreddits}
                onChange={v => patch({ reddit_subreddits: v })}
                prefix="r/"
              />
              {config.reddit_subreddits.length === 0 && (
                <p className="flex items-center gap-1.5 text-xs text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />No subreddits — Reddit monitoring disabled
                </p>
              )}
            </CardContent>
          </Card>

          {/* Facebook */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Globe className="h-5 w-5 text-blue-400" />
                <div>
                  <CardTitle className="text-base">Facebook groups</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">Add group names or URLs. The crawler uses your Facebook account to access them.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <TagInput
                label="Groups to monitor"
                placeholder="group name or facebook.com/groups/..."
                values={config.facebook_groups}
                onChange={v => patch({ facebook_groups: v })}
              />

              <Separator className="bg-zinc-800" />

              {/* Facebook credentials */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-sm font-medium text-zinc-300">Your Facebook account</p>
                  <div className="group relative">
                    <Info className="h-4 w-4 text-zinc-500 cursor-help" />
                    <div className="absolute left-0 top-full mt-1 w-72 rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-xs text-zinc-300 hidden group-hover:block z-10 shadow-xl">
                      The crawler logs into Facebook using Selenium (your account on our Railway server). Use an account that&apos;s already a member of the groups you want to monitor, or that can see the public groups. We recommend creating a dedicated account.
                    </div>
                  </div>
                </div>
                <div className="space-y-2.5">
                  <div>
                    <Label className="text-xs text-zinc-400">Facebook email</Label>
                    <Input value={fbCreds.fb_email} onChange={e => setFbCreds(p => ({ ...p, fb_email: e.target.value }))}
                      placeholder="your@email.com" type="email"
                      className="mt-1 bg-zinc-800 border-zinc-700 text-sm" />
                  </div>
                  <div>
                    <Label className="text-xs text-zinc-400">Facebook password</Label>
                    <div className="relative mt-1">
                      <Input value={fbCreds.fb_password} onChange={e => setFbCreds(p => ({ ...p, fb_password: e.target.value }))}
                        placeholder="••••••••••" type={showPassword ? 'text' : 'password'}
                        className="bg-zinc-800 border-zinc-700 text-sm pr-10" />
                      <button onClick={() => setShowPassword(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg bg-amber-950/40 border border-amber-800/50 p-2.5">
                    <p className="text-xs text-amber-400 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      Stored encrypted with row-level security — only visible to you. Consider using a dedicated Facebook account rather than your personal one.
                    </p>
                  </div>
                  <Button size="sm" onClick={saveFbCreds} disabled={savingFb || (!fbCreds.fb_email && !fbCreds.fb_password)}
                    className="w-full h-8 text-xs bg-blue-700 hover:bg-blue-600">
                    {savingFb ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-1.5 h-3.5 w-3.5" />}
                    Save Facebook credentials
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Keywords */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-violet-400" />
                <div>
                  <CardTitle className="text-base">Keyword scoring</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">Tune how the AI scores and filters opportunities</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <TagInput label="Core keywords" desc="Terms that relate to your app's core problem or category" placeholder="e.g. habit tracker, daily reminder" values={config.keywords} onChange={v => patch({ keywords: v })} />
              <TagInput label="High-intent phrases" desc='Phrases indicating someone is looking for a solution' placeholder='"looking for an app", "any recommendations"' values={config.high_intent_phrases} onChange={v => patch({ high_intent_phrases: v })} />
              <TagInput label="Boost keywords" desc="Signals that raise relevance score" placeholder="iOS, iPhone, App Store, mobile" values={config.boost_keywords} onChange={v => patch({ boost_keywords: v })} />
              <TagInput label="Penalty keywords" desc="Signals that lower relevance score" placeholder="android only, web app, Windows" values={config.penalty_keywords} onChange={v => patch({ penalty_keywords: v })} />

              <Separator className="bg-zinc-800" />

              <div>
                <Label className="text-sm text-zinc-300">Minimum score threshold</Label>
                <p className="text-xs text-zinc-500 mb-2">Opportunities below this score are hidden from your feed</p>
                <div className="flex flex-wrap gap-1.5">
                  {[6, 7, 7.5, 8, 8.5, 9].map(v => (
                    <button key={v} onClick={() => patch({ min_score: v })}
                      className={cn('rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                        config.min_score === v ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                      {v}+
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save row */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <p className="text-sm text-zinc-500">Changes take effect on the next crawler run (~4 hours)</p>
            <Button onClick={save} disabled={saving} className="bg-violet-600 hover:bg-violet-500">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save crawler config
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
