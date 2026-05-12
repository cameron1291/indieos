'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Upload, Wand2, Download, X, Check, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { App } from '@/types/database'

const TEMPLATES = [
  { id: 'dark',   label: 'Dark gradient',   from: '#0f0f1a', to: '#1e1040', text: '#fff' },
  { id: 'light',  label: 'Light minimal',   from: '#ffffff', to: '#f0f0f8', text: '#111' },
  { id: 'purple', label: 'Vibrant purple',  from: '#4c1d95', to: '#7c3aed', text: '#fff' },
  { id: 'ocean',  label: 'Deep ocean',      from: '#0c1a3e', to: '#1e3a8a', text: '#fff' },
  { id: 'sunset', label: 'Warm sunset',     from: '#7c2d12', to: '#ea580c', text: '#fff' },
  { id: 'mint',   label: 'Fresh mint',      from: '#064e3b', to: '#059669', text: '#fff' },
]

interface Slide {
  headline: string
  body: string
}

interface UploadedFile {
  file: File
  preview: string
  storageUrl?: string
  uploading?: boolean
}

const MAX_SLIDES = 6

export default function ScreenshotsPage() {
  const params = useParams()
  const appId = params.appId as string
  const [app, setApp] = useState<App | null>(null)
  const [step, setStep] = useState(1)
  const [uploads, setUploads] = useState<UploadedFile[]>([])
  const [dragging, setDragging] = useState(false)
  const [template, setTemplate] = useState('dark')
  const [slides, setSlides] = useState<Slide[]>([])
  const [generatingCopy, setGeneratingCopy] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [exportUrl, setExportUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    createClient().from('apps').select('*').eq('id', appId).single()
      .then(({ data }) => { if (data) setApp(data as App) })
  }, [appId])

  // Sync slide count to uploaded files
  useEffect(() => {
    setSlides(prev => {
      const count = uploads.length
      if (count === prev.length) return prev
      if (count > prev.length) {
        return [...prev, ...Array(count - prev.length).fill({ headline: '', body: '' })]
      }
      return prev.slice(0, count)
    })
  }, [uploads.length])

  async function uploadToStorage(uf: UploadedFile, index: number) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = uf.file.name.split('.').pop()
    const storagePath = `screenshots/${user.id}/${appId}/raw/slide-${index + 1}-${Date.now()}.${ext}`

    setUploads(prev => prev.map((u, i) => i === index ? { ...u, uploading: true } : u))

    const { error } = await supabase.storage.from('app-assets').upload(storagePath, uf.file, {
      contentType: uf.file.type,
      upsert: true,
    })

    if (error) {
      toast.error(`Failed to upload ${uf.file.name}`)
      setUploads(prev => prev.map((u, i) => i === index ? { ...u, uploading: false } : u))
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('app-assets').getPublicUrl(storagePath)
    setUploads(prev => prev.map((u, i) => i === index ? { ...u, uploading: false, storageUrl: publicUrl } : u))
  }

  function addFiles(files: FileList | File[]) {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/'))
    const remaining = MAX_SLIDES - uploads.length
    const toAdd = arr.slice(0, remaining)
    if (!toAdd.length) return

    const newUploads: UploadedFile[] = toAdd.map(file => ({
      file,
      preview: URL.createObjectURL(file),
    }))
    setUploads(prev => {
      const updated = [...prev, ...newUploads]
      // trigger uploads after state update
      newUploads.forEach((u, i) => {
        setTimeout(() => uploadToStorage(u, prev.length + i), 0)
      })
      return updated
    })
  }

  function removeUpload(index: number) {
    setUploads(prev => {
      URL.revokeObjectURL(prev[index].preview)
      return prev.filter((_, i) => i !== index)
    })
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    addFiles(e.dataTransfer.files)
  }

  async function generateCopy() {
    if (!app) return
    setGeneratingCopy(true)
    try {
      const res = await fetch('/api/screenshots/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_name: app.name,
          description: app.description,
          slide_count: uploads.length,
        }),
      })
      if (!res.ok) throw new Error()
      const { slides: generated } = await res.json()
      setSlides(generated ?? [])
      toast.success('Copy generated')
    } catch {
      toast.error('Failed to generate copy')
    } finally {
      setGeneratingCopy(false)
    }
  }

  async function exportAll() {
    const allUploaded = uploads.every(u => u.storageUrl)
    if (!allUploaded) {
      toast.error('Wait for all uploads to finish')
      return
    }
    setExporting(true)
    try {
      const res = await fetch('/api/screenshots/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          screenshots: uploads.map(u => u.storageUrl),
          template,
          slides,
        }),
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

  function canAdvance() {
    if (step === 1) return uploads.length > 0 && uploads.every(u => u.storageUrl)
    if (step === 2) return !!template
    if (step === 3) return slides.every(s => s.headline.trim())
    return false
  }

  if (!app) return (
    <div className="flex items-center justify-center p-16">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Screenshot generator</h1>
        <p className="mt-1 text-sm text-zinc-500">{app.name}</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {['Upload', 'Template', 'Content', 'Export'].map((label, i) => {
          const n = i + 1
          const done = step > n
          const active = step === n
          return (
            <div key={n} className="flex items-center gap-2">
              <button
                onClick={() => n < step && setStep(n)}
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold',
                  done ? 'bg-violet-600 text-white cursor-pointer' :
                  active ? 'bg-violet-600 text-white' :
                  'bg-zinc-200 text-zinc-500 dark:bg-zinc-800'
                )}
              >
                {done ? <Check className="h-3.5 w-3.5" /> : n}
              </button>
              <span className={cn('text-sm', active ? 'font-medium' : 'text-zinc-500')}>{label}</span>
              {i < 3 && <div className="h-px w-6 bg-zinc-200 dark:bg-zinc-800" />}
            </div>
          )
        })}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload raw screenshots</CardTitle>
            <p className="text-sm text-zinc-500">Add up to {MAX_SLIDES} screenshots — we'll composite them into all required sizes.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed p-10 transition-colors',
                dragging ? 'border-violet-500 bg-violet-50 dark:bg-violet-950/20' : 'border-zinc-300 hover:border-zinc-400 dark:border-zinc-700'
              )}
            >
              <Upload className="h-8 w-8 text-zinc-400" />
              <p className="text-sm text-zinc-500">Drag & drop screenshots here, or <span className="text-violet-600 font-medium">browse</span></p>
              <p className="text-xs text-zinc-400">PNG or JPG · Max {MAX_SLIDES} files</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              multiple
              className="hidden"
              onChange={e => e.target.files && addFiles(e.target.files)}
            />

            {uploads.length > 0 && (
              <div className="grid grid-cols-3 gap-3">
                {uploads.map((u, i) => (
                  <div key={i} className="group relative rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 aspect-[9/19.5]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={u.preview} alt={`slide ${i + 1}`} className="h-full w-full object-cover" />
                    {u.uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                        <Loader2 className="h-5 w-5 animate-spin text-white" />
                      </div>
                    )}
                    {u.storageUrl && !u.uploading && (
                      <div className="absolute top-1.5 right-1.5 rounded-full bg-green-500 p-0.5">
                        <Check className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                    <button
                      onClick={() => removeUpload(i)}
                      className="absolute top-1.5 left-1.5 hidden rounded-full bg-black/60 p-0.5 group-hover:flex"
                    >
                      <X className="h-2.5 w-2.5 text-white" />
                    </button>
                    <div className="absolute bottom-0 inset-x-0 bg-black/40 py-0.5 text-center text-[10px] text-white">
                      Slide {i + 1}
                    </div>
                  </div>
                ))}
                {uploads.length < MAX_SLIDES && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex aspect-[9/19.5] items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-violet-500 transition-colors"
                  >
                    <ImageIcon className="h-5 w-5 text-zinc-400" />
                  </button>
                )}
              </div>
            )}

            <Button
              onClick={() => setStep(2)}
              disabled={!canAdvance()}
              className="w-full"
            >
              Continue → Choose template
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Template */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose a template</CardTitle>
            <p className="text-sm text-zinc-500">Pick a background style for your screenshots.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {TEMPLATES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTemplate(t.id)}
                  className={cn(
                    'group relative overflow-hidden rounded-xl border-2 transition-all',
                    template === t.id ? 'border-violet-600 shadow-lg scale-[1.02]' : 'border-transparent hover:border-zinc-300 dark:hover:border-zinc-700'
                  )}
                >
                  <div
                    className="h-28 w-full"
                    style={{ background: `linear-gradient(135deg, ${t.from}, ${t.to})` }}
                  />
                  {template === t.id && (
                    <div className="absolute top-2 right-2 rounded-full bg-violet-600 p-0.5">
                      <Check className="h-3 w-3 text-white" />
                    </div>
                  )}
                  <div className="bg-zinc-50 py-1.5 text-center text-xs font-medium dark:bg-zinc-900">
                    {t.label}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(3)} disabled={!canAdvance()} className="flex-1">
                Continue → Add content
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Content */}
      {step === 3 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Slide content</CardTitle>
              <p className="text-sm text-zinc-500 mt-0.5">Add a headline and supporting text for each slide.</p>
            </div>
            <Button size="sm" variant="outline" onClick={generateCopy} disabled={generatingCopy}>
              {generatingCopy ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
              {generatingCopy ? 'Generating…' : 'AI generate all'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {slides.map((slide, i) => (
              <div key={i} className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center dark:bg-violet-900 dark:text-violet-300">
                    {i + 1}
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploads[i]?.preview} alt="" className="h-10 w-5 rounded object-cover" />
                  <span className="text-sm font-medium">Slide {i + 1}</span>
                </div>
                <div className="ml-7 space-y-3">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Headline</Label>
                      <span className={cn('text-xs', slide.headline.length > 30 ? 'text-red-500 font-medium' : 'text-zinc-400')}>
                        {slide.headline.length}/30
                      </span>
                    </div>
                    <Input
                      value={slide.headline}
                      onChange={e => setSlides(prev => prev.map((s, j) => j === i ? { ...s, headline: e.target.value } : s))}
                      placeholder="One bold benefit"
                      className={cn('font-mono text-sm', slide.headline.length > 30 && 'border-red-400')}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label>Supporting text</Label>
                      <span className={cn('text-xs', slide.body.length > 60 ? 'text-red-500 font-medium' : 'text-zinc-400')}>
                        {slide.body.length}/60
                      </span>
                    </div>
                    <Input
                      value={slide.body}
                      onChange={e => setSlides(prev => prev.map((s, j) => j === i ? { ...s, body: e.target.value } : s))}
                      placeholder="Supporting detail or CTA"
                      className={cn('font-mono text-sm', slide.body.length > 60 && 'border-red-400')}
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)} className="flex-1">Back</Button>
              <Button onClick={() => setStep(4)} disabled={!canAdvance()} className="flex-1">
                Continue → Export
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Export */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Export all sizes</CardTitle>
            <p className="text-sm text-zinc-500">Generates composited images for all required App Store and Play Store dimensions.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Size summary */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
              {[
                { group: 'iOS (App Store)', sizes: ['iPhone 6.9" · 1320×2868', 'iPhone 6.7" · 1290×2796', 'iPhone 6.5" · 1242×2688', 'iPhone 6.1" · 1170×2532', 'iPhone 5.5" · 1242×2208', 'iPad Pro 13" · 2064×2752', 'iPad Pro 11" · 1668×2388'] },
                { group: 'Android (Play Store)', sizes: ['Feature graphic · 1024×500', 'Phone · 1080×1920'] },
              ].map(({ group, sizes }) => (
                <div key={group} className="p-3">
                  <p className="text-xs font-semibold text-zinc-500 mb-2">{group}</p>
                  <div className="flex flex-wrap gap-1">
                    {sizes.map(s => (
                      <span key={s} className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs dark:bg-zinc-800">{s}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Slide preview summary */}
            <div className="flex gap-2 overflow-x-auto pb-1">
              {slides.map((slide, i) => (
                <div key={i} className="shrink-0 w-20 space-y-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={uploads[i]?.preview} alt="" className="w-full aspect-[9/19.5] rounded object-cover border border-zinc-200 dark:border-zinc-800" />
                  <p className="text-[10px] leading-tight text-zinc-600 truncate">{slide.headline}</p>
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
                    <Download className="mr-2 h-4 w-4" /> Download ZIP
                  </Button>
                </a>
                <Button variant="outline" className="w-full" onClick={() => { setExportUrl(null); setStep(1); setUploads([]); setSlides([]) }}>
                  Start new set
                </Button>
              </div>
            ) : (
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(3)} className="flex-1">Back</Button>
                <Button onClick={exportAll} disabled={exporting} className="flex-1">
                  {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  {exporting ? 'Exporting…' : 'Export all sizes'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
