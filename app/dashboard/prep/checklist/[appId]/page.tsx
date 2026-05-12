'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, CheckCircle2, Circle, ChevronDown, ChevronRight, Wand2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import type { App } from '@/types/database'

interface CheckItem {
  id: string
  label: string
  tip?: string
  aiNote?: string
  done: boolean
}

interface Section {
  title: string
  platform: 'ios' | 'android' | 'both'
  items: CheckItem[]
}

const BASE_CHECKLIST: Section[] = [
  {
    title: 'App metadata',
    platform: 'both',
    items: [
      { id: 'title', label: 'App title written (≤30 chars)', done: false },
      { id: 'subtitle', label: 'Subtitle / short description written', done: false },
      { id: 'description', label: 'Full description written (keyword-rich)', done: false },
      { id: 'keywords', label: 'Keywords field filled (iOS: ≤100 chars)', done: false },
      { id: 'whats_new', label: "What's new text ready", done: false },
    ],
  },
  {
    title: 'Screenshots & graphics',
    platform: 'both',
    items: [
      { id: 'ss_iphone_69', label: 'iPhone 6.9" screenshots (1320×2868)', done: false },
      { id: 'ss_iphone_65', label: 'iPhone 6.5" screenshots (1242×2688)', done: false },
      { id: 'ss_ipad_pro', label: 'iPad Pro screenshots (2064×2752)', done: false },
      { id: 'ss_gplay_feature', label: 'Google Play feature graphic (1024×500)', done: false },
      { id: 'ss_gplay_phone', label: 'Google Play phone screenshots (1080×1920)', done: false },
    ],
  },
  {
    title: 'App icon',
    platform: 'both',
    items: [
      { id: 'icon_1024', label: 'App Store icon 1024×1024 (no transparency)', done: false },
      { id: 'icon_ios_sizes', label: 'All iOS icon sizes exported', done: false },
      { id: 'icon_android_sizes', label: 'All Android mipmap sizes exported', done: false },
    ],
  },
  {
    title: 'Legal & compliance',
    platform: 'both',
    items: [
      { id: 'privacy_policy', label: 'Privacy Policy published at public URL', done: false },
      { id: 'terms', label: 'Terms of Service published', done: false },
      { id: 'data_safety', label: 'Google Play data safety section filled', done: false },
      { id: 'age_rating', label: 'Age rating questionnaire completed', done: false },
      { id: 'encryption', label: 'Export compliance / encryption declaration done', done: false },
    ],
  },
  {
    title: 'Build & technical',
    platform: 'both',
    items: [
      { id: 'bundle_id', label: 'Bundle ID / package name registered', done: false },
      { id: 'version', label: 'Version number and build number set', done: false },
      { id: 'release_build', label: 'Release build generated and tested', done: false },
      { id: 'crash_free', label: 'App is crash-free on target devices', done: false },
      { id: 'permissions', label: 'All permission usage descriptions added', done: false },
    ],
  },
  {
    title: 'iOS specific',
    platform: 'ios',
    items: [
      { id: 'apple_dev', label: 'Apple Developer account active', done: false },
      { id: 'app_connect', label: 'App record created in App Store Connect', done: false },
      { id: 'testflight', label: 'TestFlight testing completed', done: false },
      { id: 'review_notes', label: 'Review notes added for reviewer', done: false },
      { id: 'promo_url', label: 'Demo video / promo URL (optional)', done: false },
    ],
  },
  {
    title: 'Android specific',
    platform: 'android',
    items: [
      { id: 'play_console', label: 'Play Console account active ($25 fee paid)', done: false },
      { id: 'play_listing', label: 'Store listing complete in Play Console', done: false },
      { id: 'content_rating', label: 'Content rating questionnaire submitted', done: false },
      { id: 'target_audience', label: 'Target audience & content settings done', done: false },
      { id: 'release_track', label: 'Release track chosen (Internal → Production)', done: false },
    ],
  },
]

export default function ChecklistPage() {
  const params = useParams()
  const appId = params.appId as string
  const [app, setApp] = useState<App | null>(null)
  const [platform, setPlatform] = useState<'ios' | 'android' | 'both'>('both')
  const [checklist, setChecklist] = useState<Section[]>(BASE_CHECKLIST)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [generatingNotes, setGeneratingNotes] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('apps').select('*').eq('id', appId).single()
      .then(({ data }) => { if (data) setApp(data as App) })

    // Load saved state from localStorage
    const saved = localStorage.getItem(`checklist-${appId}`)
    if (saved) {
      try {
        const doneIds: string[] = JSON.parse(saved)
        setChecklist(prev => prev.map(section => ({
          ...section,
          items: section.items.map(item => ({ ...item, done: doneIds.includes(item.id) })),
        })))
      } catch {}
    }
  }, [appId])

  function toggle(sectionIdx: number, itemIdx: number) {
    setChecklist(prev => {
      const next = prev.map((s, si) => si !== sectionIdx ? s : {
        ...s,
        items: s.items.map((item, ii) => ii !== itemIdx ? item : { ...item, done: !item.done }),
      })
      // Save done state
      const doneIds = next.flatMap(s => s.items.filter(i => i.done).map(i => i.id))
      localStorage.setItem(`checklist-${appId}`, JSON.stringify(doneIds))
      return next
    })
  }

  async function generateAINotes() {
    if (!app) return
    setGeneratingNotes(true)
    try {
      const res = await fetch('/api/legal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          doc_type: 'checklist_notes',
          app_name: app.name,
          description: app.description,
        }),
      })
      // This endpoint doesn't exist yet — just show a coming soon toast
      toast.info('AI reviewer notes coming soon')
    } catch {
      toast.error('Failed')
    } finally {
      setGeneratingNotes(false)
    }
  }

  const filtered = checklist.filter(s => s.platform === 'both' || platform === 'both' || s.platform === platform)
  const totalItems = filtered.flatMap(s => s.items).length
  const doneItems = filtered.flatMap(s => s.items).filter(i => i.done).length
  const progress = totalItems > 0 ? Math.round((doneItems / totalItems) * 100) : 0

  if (!app) return (
    <div className="flex items-center justify-center p-16">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <Link href="/dashboard/prep" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 mb-3">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to App Store Prep
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">Submission checklist</h1>
            <p className="mt-1 text-sm text-zinc-500">{app.name}</p>
            <p className="mt-2 text-sm text-zinc-500 max-w-xl">
              Tick off each item as you complete it — your progress is saved automatically in the browser.
              Click <strong>AI reviewer notes</strong> to get app-specific tips for each section.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={generateAINotes} disabled={generatingNotes}>
            {generatingNotes ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
            AI reviewer notes
          </Button>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{doneItems} / {totalItems} completed</span>
            <Badge variant={progress === 100 ? 'default' : 'secondary'} className={progress === 100 ? 'bg-green-600' : ''}>
              {progress}%
            </Badge>
          </div>
          <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className="h-2 rounded-full bg-violet-600 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Platform filter */}
      <div className="flex gap-2">
        {(['both', 'ios', 'android'] as const).map(p => (
          <Button
            key={p}
            size="sm"
            variant={platform === p ? 'default' : 'outline'}
            onClick={() => setPlatform(p)}
          >
            {p === 'both' ? 'All' : p === 'ios' ? 'iOS only' : 'Android only'}
          </Button>
        ))}
      </div>

      {/* Checklist sections */}
      {filtered.map((section, si) => {
        const sectionDone = section.items.filter(i => i.done).length
        const isCollapsed = collapsed[section.title]

        return (
          <Card key={section.title}>
            <CardHeader
              className="cursor-pointer pb-2"
              onClick={() => setCollapsed(prev => ({ ...prev, [section.title]: !prev[section.title] }))}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
                  <CardTitle className="text-base">{section.title}</CardTitle>
                  {section.platform !== 'both' && (
                    <Badge variant="outline" className="text-xs capitalize">{section.platform}</Badge>
                  )}
                </div>
                <span className="text-sm text-zinc-500">{sectionDone}/{section.items.length}</span>
              </div>
            </CardHeader>

            {!isCollapsed && (
              <CardContent className="space-y-1">
                {section.items.map((item, ii) => (
                  <button
                    key={item.id}
                    onClick={() => toggle(si, ii)}
                    className="flex w-full items-start gap-3 rounded-md p-2 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    {item.done
                      ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500 mt-0.5" />
                      : <Circle className="h-4 w-4 shrink-0 text-zinc-300 mt-0.5" />
                    }
                    <div className="flex-1">
                      <span className={cn('text-sm', item.done && 'line-through text-zinc-400')}>
                        {item.label}
                      </span>
                      {item.aiNote && (
                        <p className="mt-0.5 text-xs text-violet-600 dark:text-violet-400">{item.aiNote}</p>
                      )}
                    </div>
                  </button>
                ))}
              </CardContent>
            )}
          </Card>
        )
      })}
    </div>
  )
}
