'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { X, Plus, Loader2, Wand2, Trash2 } from 'lucide-react'
import type { App } from '@/types/database'

function TagInput({ label, values, onChange, placeholder }: {
  label: string
  values: string[]
  onChange: (v: string[]) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')
  function add() {
    const val = input.trim()
    if (val && !values.includes(val)) onChange([...values, val])
    setInput('')
  }
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} placeholder={placeholder ?? 'Type and press Enter'} className="flex-1" />
        <Button type="button" variant="outline" size="icon" onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {values.map(v => (
            <Badge key={v} variant="secondary" className="gap-1 pr-1">
              {v}
              <button onClick={() => onChange(values.filter(x => x !== v))} className="ml-0.5 hover:text-red-500"><X className="h-3 w-3" /></button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AppSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const appId = params.appId as string
  const [app, setApp] = useState<App | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('apps').select('*').eq('id', appId).single().then(({ data }) => {
      if (data) setApp(data as App)
    })
  }, [appId])

  function update(partial: Partial<App>) {
    setApp(prev => prev ? { ...prev, ...partial } : prev)
  }

  async function generateConfig() {
    if (!app) return
    setGenerating(true)
    try {
      const res = await fetch('/api/apps/generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: app.name, description: app.description, target_user: app.target_user, problem_solved: app.problem_solved, platform: app.platform }),
      })
      if (!res.ok) throw new Error()
      const config = await res.json()
      update({ keywords: config.keywords ?? [], high_intent_phrases: config.high_intent_phrases ?? [], penalty_keywords: config.penalty_keywords ?? [], boost_keywords: config.boost_keywords ?? [], reddit_subreddits: config.reddit_subreddits ?? [] })
      toast.success('Config regenerated')
    } catch {
      toast.error('Failed to generate config')
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    if (!app) return
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from('apps').update({
      name: app.name, description: app.description, target_user: app.target_user,
      problem_solved: app.problem_solved, tone: app.tone,
      app_store_url: app.app_store_url, play_store_url: app.play_store_url,
      website_url: app.website_url, bundle_id: app.bundle_id, platform: app.platform,
      keywords: app.keywords, high_intent_phrases: app.high_intent_phrases,
      penalty_keywords: app.penalty_keywords, boost_keywords: app.boost_keywords,
      reddit_subreddits: app.reddit_subreddits, facebook_groups: app.facebook_groups,
      monitoring_active: app.monitoring_active, min_score: app.min_score,
    }).eq('id', appId)
    if (error) toast.error(error.message)
    else toast.success('Settings saved')
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('apps').delete().eq('id', appId)
    toast.success('App deleted')
    router.push('/dashboard/apps')
    router.refresh()
  }

  if (!app) return <div className="p-6 text-sm text-zinc-500">Loading…</div>

  const TONE_OPTIONS = ['casual and helpful', 'professional and direct', 'technical and precise']

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">{app.name}</h1>
        <p className="text-sm text-zinc-500">App ID: {appId}</p>
      </div>

      {/* Basics */}
      <Card>
        <CardHeader><CardTitle>App basics</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>App name</Label>
            <Input value={app.name} onChange={e => update({ name: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={app.description ?? ''} onChange={e => update({ description: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <div className="flex gap-2">
              {(['ios', 'android', 'both'] as const).map(p => (
                <Button key={p} type="button" variant={app.platform === p ? 'default' : 'outline'} size="sm" onClick={() => update({ platform: p })}>
                  {p === 'both' ? 'Both' : p === 'ios' ? 'iOS' : 'Android'}
                </Button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>App Store URL</Label><Input type="url" value={app.app_store_url ?? ''} onChange={e => update({ app_store_url: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Play Store URL</Label><Input type="url" value={app.play_store_url ?? ''} onChange={e => update({ play_store_url: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Website URL</Label><Input type="url" value={app.website_url ?? ''} onChange={e => update({ website_url: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Bundle ID</Label><Input value={app.bundle_id ?? ''} onChange={e => update({ bundle_id: e.target.value })} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Audience */}
      <Card>
        <CardHeader><CardTitle>Target audience</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5"><Label>Target user</Label><Input value={app.target_user ?? ''} onChange={e => update({ target_user: e.target.value })} /></div>
          <div className="space-y-1.5"><Label>Problem solved</Label><Textarea rows={2} value={app.problem_solved ?? ''} onChange={e => update({ problem_solved: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Reply tone</Label>
            <div className="flex flex-wrap gap-2">
              {TONE_OPTIONS.map(t => (
                <Button key={t} type="button" variant={app.tone === t ? 'default' : 'outline'} size="sm" onClick={() => update({ tone: t })}>{t}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Monitoring */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <CardTitle>Monitoring config</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={generateConfig} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
            {generating ? 'Regenerating…' : 'Regenerate with AI'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium">Monitoring active</p>
              <p className="text-xs text-zinc-500">Crawler will scan for this app</p>
            </div>
            <Button type="button" variant={app.monitoring_active ? 'default' : 'outline'} size="sm" onClick={() => update({ monitoring_active: !app.monitoring_active })}>
              {app.monitoring_active ? 'Active' : 'Paused'}
            </Button>
          </div>
          <div className="space-y-1.5">
            <Label>Min score threshold</Label>
            <Input type="number" min={0} max={10} step={0.5} value={app.min_score} onChange={e => update({ min_score: parseFloat(e.target.value) })} className="w-24" />
          </div>
          <TagInput label="Keywords" values={app.keywords} onChange={v => update({ keywords: v })} />
          <TagInput label="High intent phrases" values={app.high_intent_phrases} onChange={v => update({ high_intent_phrases: v })} />
          <TagInput label="Penalty keywords" values={app.penalty_keywords} onChange={v => update({ penalty_keywords: v })} />
          <TagInput label="Boost keywords" values={app.boost_keywords} onChange={v => update({ boost_keywords: v })} />
          <TagInput label="Reddit subreddits (without r/)" values={app.reddit_subreddits} onChange={v => update({ reddit_subreddits: v })} />
          <TagInput label="Facebook group URLs" values={app.facebook_groups} onChange={v => update({ facebook_groups: v })} placeholder="https://www.facebook.com/groups/…" />
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {saving ? 'Saving…' : 'Save settings'}
      </Button>

      {/* Danger zone */}
      <Card className="border-red-200 dark:border-red-900">
        <CardHeader>
          <CardTitle className="text-red-600">Danger zone</CardTitle>
          <CardDescription>Deleting this app removes all opportunities and data permanently.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            {confirmDelete ? 'Click again to confirm delete' : 'Delete app'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
