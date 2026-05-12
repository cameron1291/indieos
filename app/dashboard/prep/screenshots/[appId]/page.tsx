'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createClient } from '@/lib/supabase'
import { Loader2, Upload, Wand2, Download, X, Check, ArrowLeft, ChevronRight, Smartphone } from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { App } from '@/types/database'

async function uploadViaServer(file: File, appId: string, index: number): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('appId', appId)
  fd.append('index', String(index))
  const res = await fetch('/api/screenshots/upload', { method: 'POST', body: fd })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Upload failed')
  return data.url as string
}

const TEMPLATES = [
  { id: 'dark',    label: 'Midnight',      from: '#0f0f1a', to: '#1e1040', accent: '#7c3aed', text: '#ffffff' },
  { id: 'light',   label: 'Clean white',   from: '#f8f8ff', to: '#eff0ff', accent: '#4f46e5', text: '#111111' },
  { id: 'purple',  label: 'Violet burst',  from: '#3b0764', to: '#7c3aed', accent: '#c4b5fd', text: '#ffffff' },
  { id: 'ocean',   label: 'Deep ocean',    from: '#0c1445', to: '#1d4ed8', accent: '#93c5fd', text: '#ffffff' },
  { id: 'sunset',  label: 'Warm sunset',   from: '#431407', to: '#ea580c', accent: '#fcd34d', text: '#ffffff' },
  { id: 'forest',  label: 'Forest',        from: '#052e16', to: '#16a34a', accent: '#86efac', text: '#ffffff' },
]

interface Slide { headline: string; body: string }
interface UploadedFile { file: File; preview: string; storageUrl?: string; uploading?: boolean }

const MAX_SLIDES = 6

function PhoneMockup({
  imageUrl,
  headline,
  body,
  tmpl,
  small = false,
}: {
  imageUrl?: string
  headline?: string
  body?: string
  tmpl: typeof TEMPLATES[0]
  small?: boolean
}) {
  return (
    <div
      className={cn('relative rounded-2xl overflow-hidden flex flex-col', small ? 'aspect-[9/19]' : 'aspect-[9/19]')}
      style={{ background: `linear-gradient(160deg, ${tmpl.from} 0%, ${tmpl.to} 100%)` }}
    >
      {/* Top text */}
      <div className="px-3 pt-4 pb-2 text-center">
        <p
          className={cn('font-extrabold leading-tight tracking-tight', small ? 'text-[8px]' : 'text-sm')}
          style={{ color: tmpl.text }}
        >
          {headline || (small ? 'Headline' : 'Your headline here')}
        </p>
        {body && (
          <p
            className={cn('mt-1 leading-tight opacity-75', small ? 'text-[6px]' : 'text-xs')}
            style={{ color: tmpl.text }}
          >
            {body}
          </p>
        )}
      </div>

      {/* Phone frame */}
      <div className="flex flex-1 items-center justify-center pb-4 px-4">
        <div
          className={cn(
            'relative w-full rounded-xl overflow-hidden shadow-2xl',
            'border-2',
          )}
          style={{ borderColor: `${tmpl.text}22`, aspectRatio: '9/19' }}
        >
          {imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="app screenshot" className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center"
              style={{ backgroundColor: `${tmpl.text}11` }}
            >
              <Smartphone
                className={cn(small ? 'h-4 w-4' : 'h-8 w-8')}
                style={{ color: `${tmpl.text}44` }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Accent dot */}
      <div
        className={cn('absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full', small ? 'h-1 w-6' : 'h-1.5 w-10')}
        style={{ backgroundColor: tmpl.accent }}
      />
    </div>
  )
}

export default function ScreenshotsPage() {
  const params = useParams()
  const appId = params.appId as string
  const [app, setApp] = useState<App | null>(null)
  const [step, setStep] = useState(1)
  const [uploads, setUploads] = useState<UploadedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [template, setTemplate] = useState('dark')
  const [activeSlide, setActiveSlide] = useState(0)
  const [slides, setSlides] = useState<Slide[]>([])
  const [generatingCopy, setGeneratingCopy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeTmpl = TEMPLATES.find(t => t.id === template) ?? TEMPLATES[0]

  useEffect(() => {
    createClient().from('apps').select('*').eq('id', appId).single()
      .then(({ data }) => { if (data) setApp(data as App) })
  }, [appId])

  useEffect(() => {
    setSlides(prev => {
      const count = uploads.length
      if (count === prev.length) return prev
      if (count > prev.length) return [...prev, ...Array(count - prev.length).fill({ headline: '', body: '' })]
      return prev.slice(0, count)
    })
  }, [uploads.length])

  async function uploadToStorage(uf: UploadedFile, index: number) {
    setUploads(prev => prev.map((u, i) => i === index ? { ...u, uploading: true } : u))
    try {
      const publicUrl = await uploadViaServer(uf.file, appId, index + 1)
      setUploads(prev => prev.map((u, i) => i === index ? { ...u, uploading: false, storageUrl: publicUrl } : u))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Upload failed: ${uf.file.name}`)
      setUploads(prev => prev.map((u, i) => i === index ? { ...u, uploading: false } : u))
    }
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    const toAdd = arr.slice(0, MAX_SLIDES - uploads.length)
    if (!toAdd.length) return
    const newUploads: UploadedFile[] = toAdd.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setUploads(prev => {
      const next = [...prev, ...newUploads]
      newUploads.forEach((u, i) => setTimeout(() => uploadToStorage(u, prev.length + i), 0))
      return next
    })
  }

  function removeUpload(index: number) {
    setUploads(prev => { URL.revokeObjectURL(prev[index].preview); return prev.filter((_, i) => i !== index) })
    if (activeSlide >= uploads.length - 1) setActiveSlide(Math.max(0, uploads.length - 2))
  }

  async function generateCopy() {
    if (!app) return
    setGeneratingCopy(true)
    try {
      const res = await fetch('/api/screenshots/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_name: app.name, description: app.description, slide_count: uploads.length }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      setSlides(data.slides ?? [])
      toast.success('Copy generated — edit as needed')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate copy')
    } finally {
      setGeneratingCopy(false)
    }
  }

  async function exportAll() {
    if (!uploads.every(u => u.storageUrl)) { toast.error('Wait for uploads to finish'); return }
    setExporting(true)
    try {
      const res = await fetch('/api/screenshots/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId, screenshots: uploads.map(u => u.storageUrl), template, slides }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Export failed')
      setExportUrl(data.url)
      toast.success('Export ready!')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const canAdvance = () => {
    if (step === 1) return uploads.length > 0 && uploads.every(u => u.storageUrl)
    if (step === 2) return !!template
    if (step === 3) return slides.every(s => s.headline.trim())
    return false
  }

  if (!app) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-zinc-400" /></div>

  const STEPS = ['Upload', 'Template', 'Content', 'Export']

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <Link href="/dashboard/prep" className="inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
          <ArrowLeft className="h-3.5 w-3.5" /> App Store Prep
        </Link>
        <div className="mt-2 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Screenshot generator</h1>
            <p className="text-sm text-zinc-500">{app.name}</p>
          </div>
          {/* Step bar */}
          <div className="hidden sm:flex items-center gap-1">
            {STEPS.map((label, i) => {
              const n = i + 1
              const done = step > n
              const active = step === n
              return (
                <div key={n} className="flex items-center gap-1">
                  <button
                    onClick={() => done && setStep(n)}
                    disabled={!done}
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      done ? 'bg-violet-600 text-white cursor-pointer hover:bg-violet-500' :
                      active ? 'bg-violet-600 text-white' :
                      'bg-zinc-200 text-zinc-500 dark:bg-zinc-700'
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : n}
                  </button>
                  <span className={cn('text-xs mr-1', active ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-400')}>{label}</span>
                  {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-zinc-300 mr-1" />}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl p-6">

        {/* ── STEP 1: Upload ── */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-3 dark:border-zinc-700 dark:bg-zinc-900">
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onDrop={e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }}
                onClick={() => !uploads.length && fileInputRef.current?.click()}
                className={cn(
                  'flex flex-col items-center gap-4 rounded-lg p-12 transition-colors',
                  !uploads.length && 'cursor-pointer',
                  dragging ? 'bg-violet-50 dark:bg-violet-950/20' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40',
                )}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-100 dark:bg-violet-900/40">
                  <Upload className="h-7 w-7 text-violet-600" />
                </div>
                <div className="text-center">
                  <p className="text-base font-semibold text-zinc-700 dark:text-zinc-200">
                    {uploads.length ? 'Add more screenshots' : 'Drop your app screenshots here'}
                  </p>
                  <p className="mt-1 text-sm text-zinc-500">PNG or JPG · Up to {MAX_SLIDES} files · We'll composite them into all store sizes</p>
                </div>
                <Button variant="outline" onClick={e => { e.stopPropagation(); fileInputRef.current?.click() }}>
                  Choose files
                </Button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" multiple className="hidden" onChange={e => e.target.files && addFiles(e.target.files)} />

            {uploads.length > 0 && (
              <>
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                  {uploads.map((u, i) => (
                    <div key={i} className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
                      <div className="aspect-[9/19.5]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u.preview} alt={`slide ${i + 1}`} className="h-full w-full object-cover" />
                      </div>
                      {u.uploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                        </div>
                      )}
                      {u.storageUrl && (
                        <div className="absolute top-2 right-2 rounded-full bg-green-500 p-0.5 shadow">
                          <Check className="h-2.5 w-2.5 text-white" />
                        </div>
                      )}
                      <button
                        onClick={() => removeUpload(i)}
                        className="absolute top-2 left-2 hidden rounded-full bg-black/60 p-0.5 group-hover:flex hover:bg-red-600 transition-colors"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/60 to-transparent py-1.5 text-center text-[10px] font-medium text-white">
                        Slide {i + 1}
                      </div>
                    </div>
                  ))}
                  {uploads.length < MAX_SLIDES && (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex aspect-[9/19.5] items-center justify-center rounded-xl border-2 border-dashed border-zinc-300 hover:border-violet-500 hover:bg-violet-50 transition-colors dark:border-zinc-700 dark:hover:bg-violet-950/20"
                    >
                      <Upload className="h-5 w-5 text-zinc-400" />
                    </button>
                  )}
                </div>

                <Button
                  onClick={() => setStep(2)}
                  disabled={!canAdvance()}
                  className="w-full bg-violet-600 hover:bg-violet-500"
                  size="lg"
                >
                  {uploads.some(u => u.uploading) ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading…</>
                  ) : (
                    <>Choose template <ChevronRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2: Template ── */}
        {step === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Choose a background template</h2>
              <p className="mt-1 text-sm text-zinc-500">Pick the style that matches your brand. You'll see a live preview below.</p>
            </div>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={cn(
                    'group relative overflow-hidden rounded-2xl border-2 transition-all text-left',
                    template === t.id
                      ? 'border-violet-600 shadow-xl shadow-violet-500/20 scale-[1.02]'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-600'
                  )}
                >
                  <div className="aspect-[9/16]">
                    <PhoneMockup
                      imageUrl={uploads[0]?.preview}
                      headline="Supercharge your workflow"
                      body="Built for speed"
                      tmpl={t}
                      small
                    />
                  </div>
                  <div className="flex items-center justify-between bg-white px-2 py-1.5 dark:bg-zinc-900">
                    <span className="text-xs font-semibold">{t.label}</span>
                    {template === t.id && (
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-violet-600">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} className="flex-1 bg-violet-600 hover:bg-violet-500" size="lg">
                Add content <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Content ── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Add slide content</h2>
                <p className="mt-1 text-sm text-zinc-500">Write a bold headline for each slide. Keep it under 30 characters.</p>
              </div>
              <Button size="sm" variant="outline" onClick={generateCopy} disabled={generatingCopy}>
                {generatingCopy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
                {generatingCopy ? 'Writing…' : 'AI write all'}
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* Slide tabs */}
              <div className="space-y-3">
                {slides.map((slide, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveSlide(i)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all',
                      activeSlide === i
                        ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/30'
                        : 'border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900'
                    )}
                  >
                    <div className="h-12 w-6 shrink-0 overflow-hidden rounded">
                      <PhoneMockup imageUrl={uploads[i]?.preview} headline={slide.headline} body={slide.body} tmpl={activeTmpl} small />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-400">Slide {i + 1}</p>
                      <p className={cn('truncate text-sm font-medium', !slide.headline && 'text-zinc-400 italic')}>
                        {slide.headline || 'No headline yet'}
                      </p>
                      {slide.headline && (
                        <div className="mt-0.5 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className={cn('h-full rounded-full transition-all', slide.headline.length > 30 ? 'bg-red-400' : 'bg-violet-500')}
                            style={{ width: `${Math.min(100, (slide.headline.length / 30) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                    {slide.headline && <Check className="h-4 w-4 shrink-0 text-green-500" />}
                  </button>
                ))}
              </div>

              {/* Active slide editor + preview */}
              {slides[activeSlide] !== undefined && (
                <div className="space-y-4">
                  {/* Live preview */}
                  <div className="mx-auto w-40">
                    <PhoneMockup
                      imageUrl={uploads[activeSlide]?.preview}
                      headline={slides[activeSlide].headline}
                      body={slides[activeSlide].body}
                      tmpl={activeTmpl}
                    />
                  </div>

                  {/* Inputs */}
                  <div className="rounded-xl border border-zinc-200 bg-white p-4 space-y-4 dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Headline <span className="text-zinc-400 font-normal">(bold, top)</span></Label>
                        <span className={cn('text-xs font-medium', slides[activeSlide].headline.length > 30 ? 'text-red-500' : 'text-zinc-400')}>
                          {slides[activeSlide].headline.length}/30
                        </span>
                      </div>
                      <Input
                        autoFocus
                        value={slides[activeSlide].headline}
                        onChange={e => setSlides(prev => prev.map((s, j) => j === activeSlide ? { ...s, headline: e.target.value } : s))}
                        placeholder="e.g. Invoice in 30 seconds"
                        className={cn(slides[activeSlide].headline.length > 30 && 'border-red-400 focus-visible:ring-red-400')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Supporting text <span className="text-zinc-400 font-normal">(optional)</span></Label>
                        <span className={cn('text-xs font-medium', slides[activeSlide].body.length > 60 ? 'text-red-500' : 'text-zinc-400')}>
                          {slides[activeSlide].body.length}/60
                        </span>
                      </div>
                      <Input
                        value={slides[activeSlide].body}
                        onChange={e => setSlides(prev => prev.map((s, j) => j === activeSlide ? { ...s, body: e.target.value } : s))}
                        placeholder="e.g. No typing required"
                        className={cn(slides[activeSlide].body.length > 60 && 'border-red-400 focus-visible:ring-red-400')}
                      />
                    </div>
                    {activeSlide < slides.length - 1 && (
                      <Button size="sm" variant="outline" className="w-full" onClick={() => setActiveSlide(i => i + 1)}>
                        Next slide →
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button
                onClick={() => setStep(4)}
                disabled={!canAdvance()}
                className="flex-1 bg-violet-600 hover:bg-violet-500"
                size="lg"
              >
                Export all sizes <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Export ── */}
        {step === 4 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Export all sizes</h2>
              <p className="mt-1 text-sm text-zinc-500">
                Generates composited screenshots for all required iOS and Android dimensions — one ZIP, ready to upload.
              </p>
            </div>

            {/* Final slide previews */}
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {slides.map((slide, i) => (
                <div key={i} className="space-y-1">
                  <div className="rounded-xl overflow-hidden shadow-lg">
                    <PhoneMockup imageUrl={uploads[i]?.preview} headline={slide.headline} body={slide.body} tmpl={activeTmpl} small />
                  </div>
                  <p className="text-center text-[10px] text-zinc-500 leading-tight truncate">{slide.headline}</p>
                </div>
              ))}
            </div>

            {/* Size list */}
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
              {[
                { group: 'iPhone', sizes: ['6.9" · 1320×2868', '6.7" · 1290×2796', '6.5" · 1242×2688', '5.5" · 1242×2208'] },
                { group: 'iPad', sizes: ['13" · 2064×2752', '11" · 1668×2388'] },
                { group: 'Android', sizes: ['Phone · 1080×1920', 'Feature · 1024×500'] },
              ].map(({ group, sizes }, gi) => (
                <div key={group} className={cn('flex items-center gap-4 px-4 py-3 bg-white dark:bg-zinc-900', gi > 0 && 'border-t border-zinc-100 dark:border-zinc-800')}>
                  <span className="w-16 shrink-0 text-xs font-semibold text-zinc-500">{group}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {sizes.map(s => (
                      <span key={s} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {exportUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-xl bg-green-50 border border-green-200 p-4 dark:bg-green-950 dark:border-green-800">
                  <Check className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="font-medium text-green-800 dark:text-green-200">Your export is ready</p>
                    <p className="text-sm text-green-700 dark:text-green-300">Download link valid for 1 hour</p>
                  </div>
                </div>
                <a href={exportUrl} download className="block">
                  <Button className="w-full bg-violet-600 hover:bg-violet-500" size="lg">
                    <Download className="mr-2 h-4 w-4" /> Download ZIP
                  </Button>
                </a>
                <Button variant="outline" className="w-full" onClick={() => { setExportUrl(null); setStep(1); setUploads([]); setSlides([]) }}>
                  Start a new set
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
                <Button onClick={exportAll} disabled={exporting} className="flex-1 bg-violet-600 hover:bg-violet-500" size="lg">
                  {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {exporting ? 'Compositing…' : 'Export all sizes'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
