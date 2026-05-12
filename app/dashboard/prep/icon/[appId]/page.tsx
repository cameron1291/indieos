'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Wand2, Download, Check, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { App } from '@/types/database'

interface Concept {
  style: string
  url: string
  index: number
}

const SIZE_GROUPS = [
  { label: 'iOS (App Store)', sizes: ['120px', '180px', '76px', '152px', '167px', '40px', '60px', '58px', '87px', '80px', '1024px'] },
  { label: 'Android (Play Store)', sizes: ['48px', '72px', '96px', '144px', '192px', '512px'] },
]

export default function IconPage() {
  const params = useParams()
  const appId = params.appId as string
  const [app, setApp] = useState<App | null>(null)
  const [colorHint, setColorHint] = useState('')
  const [concepts, setConcepts] = useState<Concept[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [generating, setGenerating] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportUrl, setExportUrl] = useState<string | null>(null)

  useEffect(() => {
    createClient().from('apps').select('*').eq('id', appId).single()
      .then(({ data }) => { if (data) setApp(data as App) })
  }, [appId])

  async function generate() {
    if (!app) return
    setGenerating(true)
    setConcepts([])
    setSelected(null)
    setExportUrl(null)
    try {
      const res = await fetch('/api/icon/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          app_name: app.name,
          description: app.description,
          color_hint: colorHint || undefined,
        }),
      })
      if (!res.ok) throw new Error()
      const { concepts: c } = await res.json()
      setConcepts(c ?? [])
      toast.success(`${(c ?? []).length} icon concepts generated`)
    } catch {
      toast.error('Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  async function exportIcon() {
    if (selected === null) return
    const concept = concepts[selected]
    if (!concept) return
    setExporting(true)
    try {
      const res = await fetch('/api/icon/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, image_url: concept.url }),
      })
      if (!res.ok) throw new Error()
      const { url } = await res.json()
      setExportUrl(url)
      toast.success('Export ready!')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (!app) return (
    <div className="flex items-center justify-center p-16">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">App icon generator</h1>
        <p className="mt-1 text-sm text-zinc-500">{app.name}</p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="color">Color / style hint (optional)</Label>
            <Input
              id="color"
              placeholder="e.g. blue and white, dark theme, neon green"
              value={colorHint}
              onChange={e => setColorHint(e.target.value)}
            />
          </div>
          <Button onClick={generate} disabled={generating} className="w-full">
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {generating ? 'Generating 4 concepts…' : 'Generate icon concepts'}
          </Button>
        </CardContent>
      </Card>

      {concepts.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Choose a concept</CardTitle>
            <Button size="sm" variant="outline" onClick={generate} disabled={generating}>
              <RefreshCw className="mr-2 h-3.5 w-3.5" /> Regenerate
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {concepts.map((c, i) => (
                <button
                  key={i}
                  onClick={() => { setSelected(i); setExportUrl(null) }}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border-2 transition-all',
                    selected === i ? 'border-violet-600 shadow-lg scale-[1.02]' : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={c.url}
                    alt={c.style}
                    className="aspect-square w-full rounded-xl object-cover"
                  />
                  {selected === i && (
                    <div className="absolute top-2 right-2 rounded-full bg-violet-600 p-0.5">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <p className="mt-1.5 text-center text-xs text-zinc-500 capitalize">{c.style}</p>
                </button>
              ))}
            </div>

            {selected !== null && (
              <div className="space-y-4">
                {/* Size preview */}
                <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {SIZE_GROUPS.map(({ label, sizes }) => (
                    <div key={label} className="p-3">
                      <p className="text-xs font-semibold text-zinc-500 mb-2">{label}</p>
                      <div className="flex flex-wrap gap-1">
                        {sizes.map(s => (
                          <span key={s} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{s}</span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {exportUrl ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg bg-green-50 p-3 dark:bg-green-950">
                      <Check className="h-4 w-4 text-green-600" />
                      <p className="text-sm text-green-700 dark:text-green-300">Export ready — link valid for 1 hour</p>
                    </div>
                    <a href={exportUrl} download>
                      <Button className="w-full">
                        <Download className="mr-2 h-4 w-4" /> Download ZIP (iOS + Android)
                      </Button>
                    </a>
                  </div>
                ) : (
                  <Button onClick={exportIcon} disabled={exporting} className="w-full">
                    {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    {exporting ? 'Exporting all sizes…' : 'Export all sizes'}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
