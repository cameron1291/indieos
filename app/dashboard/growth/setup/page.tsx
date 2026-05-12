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
  Loader2, Save, Plus, X, Settings2, Radio, Globe, Hash, AlertTriangle, ArrowUp
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { App } from '@/types/database'

function TagInput({
  label,
  placeholder,
  values,
  onChange,
  prefix,
}: {
  label: string
  placeholder: string
  values: string[]
  onChange: (v: string[]) => void
  prefix?: string
}) {
  const [input, setInput] = useState('')

  function add() {
    const trimmed = input.trim().replace(/^r\/|^\//, '')
    if (!trimmed || values.includes(trimmed)) { setInput(''); return }
    onChange([...values, trimmed])
    setInput('')
  }

  function remove(val: string) {
    onChange(values.filter(v => v !== val))
  }

  return (
    <div>
      <Label className="text-sm text-zinc-300">{label}</Label>
      <div className="mt-1.5 flex gap-2">
        <div className="relative flex-1">
          {prefix && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">{prefix}</span>
          )}
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder={placeholder}
            className={cn('bg-zinc-800 border-zinc-700 text-sm', prefix && 'pl-8')}
          />
        </div>
        <Button size="sm" variant="outline" className="border-zinc-700 hover:bg-zinc-800" onClick={add} disabled={!input.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {values.map(v => (
            <Badge key={v} variant="secondary" className="gap-1 bg-zinc-800 text-zinc-300 hover:bg-zinc-700">
              {prefix}{v}
              <button onClick={() => remove(v)} className="ml-0.5 opacity-60 hover:opacity-100">
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

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

export default function CrawlerSetupPage() {
  const [apps, setApps] = useState<App[]>([])
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      createClient().from('apps').select('*').eq('user_id', user.id).order('created_at').then(({ data }) => {
        const list = (data ?? []) as App[]
        setApps(list)
        if (list.length > 0) {
          setSelectedAppId(list[0].id)
          setConfig(appToConfig(list[0]))
        }
        setLoading(false)
      })
    })
  }, [])

  function appToConfig(app: App): AppConfig {
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
    setSelectedAppId(id)
    setConfig(appToConfig(app))
  }

  function patch(update: Partial<AppConfig>) {
    setConfig(prev => prev ? { ...prev, ...update } : prev)
  }

  async function save() {
    if (!selectedAppId || !config) return
    setSaving(true)
    const { error } = await createClient()
      .from('apps')
      .update({
        reddit_subreddits: config.reddit_subreddits,
        facebook_groups: config.facebook_groups,
        keywords: config.keywords,
        high_intent_phrases: config.high_intent_phrases,
        penalty_keywords: config.penalty_keywords,
        boost_keywords: config.boost_keywords,
        min_score: config.min_score,
        monitoring_active: config.monitoring_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selectedAppId)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Crawler config saved')
      // Update local apps list
      setApps(prev => prev.map(a => a.id === selectedAppId ? { ...a, ...config } : a))
    }
    setSaving(false)
  }

  const selectedApp = apps.find(a => a.id === selectedAppId)

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  if (!apps.length) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <Settings2 className="h-10 w-10 text-zinc-600 mb-4" />
        <p className="text-zinc-400">No apps yet. <a href="/dashboard/apps/new" className="text-violet-400 hover:underline">Create one first.</a></p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      {/* Header */}
      <div className="rounded-2xl border border-zinc-700/40 bg-gradient-to-br from-zinc-900 to-zinc-900/60 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-900/50">
            <Settings2 className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Crawler Setup</h1>
        </div>
        <p className="text-zinc-400 max-w-lg text-sm">
          Configure where the crawler looks for opportunities for each app. Add subreddits, Facebook groups, and tune the keyword scoring.
        </p>
      </div>

      {/* App selector */}
      <div className="flex flex-wrap gap-2">
        {apps.map(app => (
          <button
            key={app.id}
            onClick={() => selectApp(app.id)}
            className={cn(
              'flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm transition-colors',
              selectedAppId === app.id
                ? 'border-violet-500 bg-violet-600/20 text-violet-300'
                : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300',
            )}
          >
            {app.name}
            {app.monitoring_active && (
              <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            )}
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
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-xl',
                    config.monitoring_active ? 'bg-green-600' : 'bg-zinc-700',
                  )}>
                    <Radio className="h-4 w-4 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-white">Monitoring</p>
                    <p className="text-xs text-zinc-500">
                      {config.monitoring_active ? 'Active — crawler is watching for opportunities' : 'Paused — no new opportunities will be found'}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => patch({ monitoring_active: !config.monitoring_active })}
                  className={cn(
                    'relative h-6 w-11 rounded-full transition-colors',
                    config.monitoring_active ? 'bg-green-600' : 'bg-zinc-700',
                  )}
                >
                  <span className={cn(
                    'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
                    config.monitoring_active ? 'translate-x-5.5' : 'translate-x-0.5',
                  )} />
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
                  <CardDescription className="text-xs text-zinc-500">The crawler will monitor these subreddits for relevant posts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TagInput
                label="Subreddits"
                placeholder="e.g. entrepreneur"
                values={config.reddit_subreddits}
                onChange={v => patch({ reddit_subreddits: v })}
                prefix="r/"
              />
              {config.reddit_subreddits.length === 0 && (
                <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  No subreddits configured — Reddit monitoring is disabled
                </p>
              )}
            </CardContent>
          </Card>

          {/* Facebook */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">📘</span>
                <div>
                  <CardTitle className="text-base">Facebook groups</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">Group names or URLs to crawl for pain-point posts</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <TagInput
                label="Groups"
                placeholder="e.g. indieapp_builders or group URL"
                values={config.facebook_groups}
                onChange={v => patch({ facebook_groups: v })}
              />
            </CardContent>
          </Card>

          {/* Keywords */}
          <Card className="border-zinc-800 bg-zinc-900">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Hash className="h-4 w-4 text-violet-400" />
                <div>
                  <CardTitle className="text-base">Keywords & scoring</CardTitle>
                  <CardDescription className="text-xs text-zinc-500">Tune how the scorer classifies opportunities</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <TagInput
                label="Core keywords"
                placeholder="e.g. habit tracker, productivity app"
                values={config.keywords}
                onChange={v => patch({ keywords: v })}
              />
              <TagInput
                label="High-intent phrases"
                placeholder='e.g. "looking for an app", "recommend an app"'
                values={config.high_intent_phrases}
                onChange={v => patch({ high_intent_phrases: v })}
              />
              <TagInput
                label="Boost keywords (increase score)"
                placeholder="e.g. iOS, iPhone, App Store"
                values={config.boost_keywords}
                onChange={v => patch({ boost_keywords: v })}
              />
              <TagInput
                label="Penalty keywords (lower score)"
                placeholder="e.g. android only, free only"
                values={config.penalty_keywords}
                onChange={v => patch({ penalty_keywords: v })}
              />

              <Separator className="bg-zinc-800" />

              <div>
                <Label className="text-sm text-zinc-300">Minimum score threshold</Label>
                <p className="text-xs text-zinc-500 mb-2">Opportunities below this score won&apos;t appear in your feed</p>
                <div className="flex items-center gap-3">
                  {[6, 7, 7.5, 8, 8.5, 9].map(v => (
                    <button
                      key={v}
                      onClick={() => patch({ min_score: v })}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                        config.min_score === v
                          ? 'bg-violet-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                      )}
                    >
                      {v}+
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save */}
          <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/60 px-4 py-3">
            <p className="text-sm text-zinc-500">
              Changes take effect on the next crawler run (~4h)
            </p>
            <Button onClick={save} disabled={saving} className="bg-violet-600 hover:bg-violet-500">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save config
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
