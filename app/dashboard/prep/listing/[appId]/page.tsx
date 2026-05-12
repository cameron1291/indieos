'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Wand2, Copy, RefreshCw, CheckCircle2, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { App } from '@/types/database'

const LIMITS: Record<string, number> = {
  title: 30,
  subtitle: 30,
  keywords: 100,
  short_description: 80,
  description: 4000,
  whats_new: 500,
}

interface Listing {
  title: string
  subtitle: string
  keywords: string
  description: string
  short_description: string
  whats_new: string
  aso_tips?: string[]
}

interface Keyword {
  keyword: string
  intent: 'high' | 'medium' | 'low'
  competition: 'high' | 'medium' | 'low'
  recommended: boolean
  why: string
}

function CharCounter({ value, limit, label }: { value: string; limit: number; label: string }) {
  const over = value.length > limit
  return (
    <div className="flex items-center justify-between">
      <Label>{label}</Label>
      <span className={cn('text-xs', over ? 'text-red-500 font-medium' : 'text-zinc-400')}>
        {value.length}/{limit}
      </span>
    </div>
  )
}

function CopyableField({ label, value, limit, onChange, multiline = false }: {
  label: string
  value: string
  limit: number
  onChange: (v: string) => void
  multiline?: boolean
}) {
  async function copy() {
    await navigator.clipboard.writeText(value)
    toast.success(`${label} copied`)
  }

  return (
    <div className="space-y-1.5">
      <CharCounter value={value} limit={limit} label={label} />
      <div className="relative">
        {multiline ? (
          <Textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            rows={label === 'Description' ? 10 : 3}
            className={cn('pr-10 font-mono text-sm', value.length > limit && 'border-red-400 focus-visible:ring-red-400')}
          />
        ) : (
          <Input
            value={value}
            onChange={e => onChange(e.target.value)}
            className={cn('pr-10 font-mono text-sm', value.length > limit && 'border-red-400 focus-visible:ring-red-400')}
          />
        )}
        <button onClick={copy} className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-700">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

export default function ListingPage() {
  const params = useParams()
  const appId = params.appId as string
  const [app, setApp] = useState<App | null>(null)
  const [platform, setPlatform] = useState<'ios' | 'android'>('ios')
  const [features, setFeatures] = useState('')
  const [primaryKeyword, setPrimaryKeyword] = useState('')
  const [listing, setListing] = useState<Listing>({
    title: '', subtitle: '', keywords: '', description: '', short_description: '', whats_new: ''
  })
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [keywords, setKeywords] = useState<Keyword[]>([])
  const [loadingKw, setLoadingKw] = useState(false)

  useEffect(() => {
    createClient().from('apps').select('*').eq('id', appId).single()
      .then(({ data }) => { if (data) setApp(data as App) })
  }, [appId])

  async function generateListing() {
    if (!app) return
    setGenerating(true)
    try {
      const res = await fetch('/api/listing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          platform,
          name: app.name,
          description: app.description,
          features,
          target_user: app.target_user,
          primary_keyword: primaryKeyword,
        }),
      })
      if (!res.ok) throw new Error()
      const result = await res.json()
      setListing({
        title: result.title ?? '',
        subtitle: result.subtitle ?? '',
        keywords: result.keywords ?? '',
        description: result.description ?? '',
        short_description: result.short_description ?? '',
        whats_new: result.whats_new ?? '',
        aso_tips: result.aso_tips,
      })
      toast.success('Listing generated')
    } catch {
      toast.error('Failed to generate listing')
    } finally {
      setGenerating(false)
    }
  }

  async function generateKeywords() {
    if (!app) return
    setLoadingKw(true)
    try {
      const res = await fetch('/api/listing/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: app.description, target_user: app.target_user, platform }),
      })
      if (!res.ok) throw new Error()
      const { keywords: kws } = await res.json()
      setKeywords(kws ?? [])
    } catch {
      toast.error('Failed to generate keywords')
    } finally {
      setLoadingKw(false)
    }
  }

  function addKeyword(kw: string) {
    const current = listing.keywords
    const separator = current ? ',' : ''
    const next = current + separator + kw
    if (next.length > LIMITS.keywords) {
      toast.warning('Keyword field is full (100 char limit)')
      return
    }
    setListing(l => ({ ...l, keywords: next }))
  }

  const INTENT_COLOURS: Record<string, string> = {
    high: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    low: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  }

  if (!app) return <div className="flex items-center justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Listing writer</h1>
        <p className="mt-1 text-sm text-zinc-500">{app.name}</p>
      </div>

      {/* Platform + inputs */}
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex gap-2">
            {(['ios', 'android'] as const).map(p => (
              <Button key={p} type="button" variant={platform === p ? 'default' : 'outline'} size="sm"
                onClick={() => setPlatform(p)}>
                {p === 'ios' ? 'iOS (App Store)' : 'Android (Play Store)'}
              </Button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="features">Key features (bullet points)</Label>
            <Textarea id="features" rows={3} placeholder="• One-tap invoice generation&#10;• Job tracking&#10;• Client management" value={features} onChange={e => setFeatures(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="kw">Primary keyword focus</Label>
            <Input id="kw" placeholder="e.g. invoice app tradies" value={primaryKeyword} onChange={e => setPrimaryKeyword(e.target.value)} />
          </div>
          <Button onClick={generateListing} disabled={generating} className="w-full">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {generating ? 'Generating…' : 'Generate listing'}
          </Button>
        </CardContent>
      </Card>

      {/* Generated listing fields */}
      {listing.title && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Generated listing</CardTitle>
            <Button size="sm" variant="outline" onClick={generateListing} disabled={generating}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Regenerate
            </Button>
          </CardHeader>
          <CardContent className="space-y-5">
            <CopyableField label="Title" value={listing.title} limit={LIMITS.title} onChange={v => setListing(l => ({ ...l, title: v }))} />
            {platform === 'ios' && (
              <CopyableField label="Subtitle" value={listing.subtitle} limit={LIMITS.subtitle} onChange={v => setListing(l => ({ ...l, subtitle: v }))} />
            )}
            <CopyableField label="Description" value={listing.description} limit={LIMITS.description} onChange={v => setListing(l => ({ ...l, description: v }))} multiline />
            {platform === 'android' && (
              <CopyableField label="Short description" value={listing.short_description} limit={LIMITS.short_description} onChange={v => setListing(l => ({ ...l, short_description: v }))} />
            )}
            <CopyableField label="What's new" value={listing.whats_new} limit={LIMITS.whats_new} onChange={v => setListing(l => ({ ...l, whats_new: v }))} multiline />

            {listing.aso_tips && listing.aso_tips.length > 0 && (
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950">
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-1.5">ASO tips</p>
                <ul className="space-y-1">
                  {listing.aso_tips.map((tip, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-blue-700 dark:text-blue-300">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Keywords section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>Keyword research</CardTitle>
          <Button size="sm" variant="outline" onClick={generateKeywords} disabled={loadingKw}>
            {loadingKw ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
            {loadingKw ? 'Generating…' : 'Research keywords'}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {platform === 'ios' && (
            <div className="space-y-1">
              <CharCounter value={listing.keywords} limit={LIMITS.keywords} label="Keyword field" />
              <Input value={listing.keywords} onChange={e => setListing(l => ({ ...l, keywords: e.target.value }))}
                className={cn('font-mono text-sm', listing.keywords.length > LIMITS.keywords && 'border-red-400')}
                placeholder="keyword1,keyword2,keyword3" />
              {listing.keywords.length > LIMITS.keywords * 0.9 && (
                <p className="text-xs text-amber-600">Approaching 100 char limit — remove less relevant keywords</p>
              )}
            </div>
          )}
          {keywords.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-left text-xs text-zinc-500">
                    <th className="pb-2 pr-3">Keyword</th>
                    <th className="pb-2 pr-3">Intent</th>
                    <th className="pb-2 pr-3">Competition</th>
                    <th className="pb-2">Why</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-900">
                  {keywords.map((kw, i) => (
                    <tr key={i} className={kw.recommended ? 'bg-violet-50 dark:bg-violet-950/20' : ''}>
                      <td className="py-2 pr-3 font-medium">{kw.keyword}</td>
                      <td className="py-2 pr-3"><Badge className={cn('text-xs', INTENT_COLOURS[kw.intent])}>{kw.intent}</Badge></td>
                      <td className="py-2 pr-3"><Badge variant="outline" className="text-xs">{kw.competition}</Badge></td>
                      <td className="py-2 pr-3 text-xs text-zinc-500">{kw.why}</td>
                      <td className="py-2">
                        {platform === 'ios' && (
                          <Button size="sm" variant="ghost" onClick={() => addKeyword(kw.keyword)}>
                            <Plus className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
