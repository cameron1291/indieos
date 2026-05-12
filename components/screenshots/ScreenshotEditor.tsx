'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Wand2, Download, Loader2, Upload, Plus, X,
  ChevronLeft, ChevronRight, Sparkles, Move, Package, Check,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import type { Slide, ScreenshotProject, SizePreset, Background, ScreenshotEffect, TextColor, TextPosition } from '@/lib/screenshots/types'
import { SIZE_PRESETS, COLOR_PRESETS } from '@/lib/screenshots/presets'
import { renderToCanvas, preloadImage } from '@/lib/screenshots/canvas-renderer'
import { createDefaultSlide } from '@/lib/screenshots/projects'
import { defaultExportSizes, downloadFullExportZip, type ExportSize } from '@/lib/screenshots/exporter'

// ─── Mini canvas for slide strip ──────────────────────────────────────────────

function SlideMiniCanvas({ slide, preset, active, onClick }: {
  slide: Slide; preset: SizePreset; active: boolean; onClick: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const go = () => { if (canvasRef.current) renderToCanvas(canvasRef.current, slide, preset) }
    if (slide.screenshotDataUrl) preloadImage(slide.screenshotDataUrl).then(go)
    else go()
  }, [slide, preset])

  const aspect = preset.height / preset.width
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative shrink-0 overflow-hidden rounded-lg border-2 transition-all',
        active ? 'border-violet-500 shadow-lg shadow-violet-500/30' : 'border-zinc-700 hover:border-zinc-500',
      )}
      style={{ width: 52, height: Math.round(52 * aspect) }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </button>
  )
}

// ─── Hotspot overlay ──────────────────────────────────────────────────────────

function HotspotSelector({ onSelect, existing, onClear }: {
  onSelect: (h: { x: number; y: number; w: number; h: number }) => void
  existing: { x: number; y: number; w: number; h: number } | null
  onClear: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState(false)
  const [s, setS] = useState({ x: 0, y: 0 })
  const [c, setC] = useState({ x: 0, y: 0 })

  const rel = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }

  return (
    <div
      ref={ref}
      className="absolute inset-0 cursor-crosshair select-none"
      onMouseDown={e => { const p = rel(e); setS(p); setC(p); setDrag(true) }}
      onMouseMove={e => { if (drag) setC(rel(e)) }}
      onMouseUp={() => {
        if (!drag) return
        setDrag(false)
        const x = Math.min(s.x, c.x), y = Math.min(s.y, c.y)
        const w = Math.abs(c.x - s.x), h = Math.abs(c.y - s.y)
        if (w > 0.04 && h > 0.04) onSelect({ x, y, w, h })
      }}
    >
      {drag && (
        <div
          className="absolute border-2 border-yellow-400 bg-yellow-400/15 pointer-events-none"
          style={{ left: `${Math.min(s.x, c.x) * 100}%`, top: `${Math.min(s.y, c.y) * 100}%`, width: `${Math.abs(c.x - s.x) * 100}%`, height: `${Math.abs(c.y - s.y) * 100}%` }}
        />
      )}
      {existing && !drag && (
        <div
          className="absolute border-2 border-yellow-400 bg-yellow-400/15 pointer-events-none"
          style={{ left: `${existing.x * 100}%`, top: `${existing.y * 100}%`, width: `${existing.w * 100}%`, height: `${existing.h * 100}%` }}
        >
          <button
            className="pointer-events-auto absolute -top-3 -right-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white shadow"
            onClick={e => { e.stopPropagation(); onClear() }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Export panel ─────────────────────────────────────────────────────────────

function ExportPanel({ project, onExportZip, onClose }: {
  project: ScreenshotProject
  onExportZip: (blob: Blob, sizes: ExportSize[]) => Promise<void>
  onClose: () => void
}) {
  const [sizes, setSizes] = useState<ExportSize[]>(defaultExportSizes)
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const toggleSize = (label: string) =>
    setSizes(prev => prev.map(s => s.preset.label === label ? { ...s, enabled: !s.enabled } : s))

  const enabledCount = sizes.filter(s => s.enabled).length
  const totalSlides = project.slides.length
  const totalRenders = enabledCount * totalSlides

  async function run() {
    setExporting(true)
    setProgress({ done: 0, total: totalRenders })
    try {
      const blob = await downloadFullExportZip(
        project.slides,
        sizes,
        project.appName,
        (done, total) => setProgress({ done, total }),
      )
      await onExportZip(blob, sizes)
      toast.success('ZIP downloaded — all store sizes included')
      onClose()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
      setProgress(null)
    }
  }

  const groupedSizes = [
    { label: 'Apple App Store', platform: 'apple' as const },
    { label: 'Google Play', platform: 'google' as const },
    { label: 'Apple Watch', platform: 'watch' as const },
  ].map(g => ({
    ...g,
    items: sizes.filter(s => s.preset.platform === g.platform),
  }))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-4">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-violet-400" />
            <h2 className="text-base font-semibold text-white">Export for App Store</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-5 space-y-5">
          {groupedSizes.map(group => (
            <div key={group.platform}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">{group.label}</p>
              <div className="space-y-1.5">
                {group.items.map(({ preset, enabled }) => (
                  <label
                    key={preset.label}
                    className={cn(
                      'flex cursor-pointer items-center justify-between rounded-lg border px-3 py-2.5 transition-colors',
                      enabled ? 'border-violet-500/50 bg-violet-950/30' : 'border-zinc-800 hover:border-zinc-600',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-5 w-5 items-center justify-center rounded border',
                        enabled ? 'border-violet-500 bg-violet-600' : 'border-zinc-600',
                      )}>
                        {enabled && <Check className="h-3 w-3 text-white" />}
                      </div>
                      <span className="text-sm text-zinc-200">{preset.label}</span>
                    </div>
                    <span className="text-xs text-zinc-500">{preset.width}×{preset.height}</span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={enabled}
                      onChange={() => toggleSize(preset.label)}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-800 p-4">
          {progress && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-zinc-400 mb-1">
                <span>Rendering…</span>
                <span>{progress.done}/{progress.total}</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-zinc-800">
                <div
                  className="h-1.5 rounded-full bg-violet-500 transition-all"
                  style={{ width: `${(progress.done / progress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-500">
              {enabledCount} sizes × {totalSlides} slides = {totalRenders} images
            </p>
            <Button
              onClick={run}
              disabled={exporting || enabledCount === 0}
              className="bg-violet-600 hover:bg-violet-500 text-white"
            >
              {exporting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Rendering…</>
                : <><Download className="mr-2 h-4 w-4" />Download ZIP</>
              }
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

interface ScreenshotEditorProps {
  project: ScreenshotProject
  onChange: (project: ScreenshotProject) => void
  onExportZip: (blob: Blob, preset?: SizePreset) => Promise<void>
}

export default function ScreenshotEditor({ project, onChange, onExportZip }: ScreenshotEditorProps) {
  const [activeSlideId, setActiveSlideId] = useState(project.activeSlideId)
  const [preset, setPreset] = useState<SizePreset>(SIZE_PRESETS[0])
  const [selectingHotspot, setSelectingHotspot] = useState(false)
  const [generatingCopy, setGeneratingCopy] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const mainCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activeSlide = project.slides.find(s => s.id === activeSlideId) ?? project.slides[0]

  const update = useCallback((updated: ScreenshotProject) => {
    onChange({ ...updated, updatedAt: Date.now() })
  }, [onChange])

  const updateSlide = useCallback((patch: Partial<Slide>) => {
    update({
      ...project,
      slides: project.slides.map(s => s.id === activeSlideId ? { ...s, ...patch } : s),
    })
  }, [project, activeSlideId, update])

  useEffect(() => {
    const canvas = mainCanvasRef.current
    if (!canvas || !activeSlide) return
    const render = () => renderToCanvas(canvas, activeSlide, preset)
    if (activeSlide.screenshotDataUrl) preloadImage(activeSlide.screenshotDataUrl).then(render)
    else render()
  }, [activeSlide, preset])

  function addSlide() {
    const base = activeSlide
    const slide = createDefaultSlide({
      background: base?.background,
      textColor: base?.textColor ?? 'white',
      textPosition: base?.textPosition ?? 'top',
      screenshotEffect: base?.screenshotEffect ?? 'float',
    })
    const next = { ...project, slides: [...project.slides, slide], activeSlideId: slide.id }
    setActiveSlideId(slide.id)
    update(next)
  }

  function removeSlide(id: string) {
    if (project.slides.length <= 1) return
    const slides = project.slides.filter(s => s.id !== id)
    const nextActive = id === activeSlideId ? slides[0].id : activeSlideId
    setActiveSlideId(nextActive)
    update({ ...project, slides, activeSlideId: nextActive })
  }

  function handleFileUpload(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Image files only'); return }
    const reader = new FileReader()
    reader.onload = e => updateSlide({ screenshotDataUrl: e.target?.result as string })
    reader.readAsDataURL(file)
  }

  async function generateCopy() {
    if (!project.appName) { toast.error('App name required'); return }
    setGeneratingCopy(true)
    try {
      const res = await fetch('/api/screenshots/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: project.appName, appDescription: project.appDescription, slideCount: project.slides.length }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      const generated: Array<{ headline: string; subtext: string }> = data.slides ?? []
      update({ ...project, slides: project.slides.map((s, i) => ({ ...s, ...(generated[i] ?? {}) })) })
      toast.success('Copy generated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    } finally {
      setGeneratingCopy(false)
    }
  }

  async function suggestPalette() {
    try {
      const res = await fetch('/api/screenshots/suggest-palette', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appName: project.appName, appDescription: project.appDescription }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      const bg: Background = { type: data.type, colors: data.colors, angle: data.angle ?? 145 }
      update({ ...project, slides: project.slides.map(s => ({ ...s, background: bg })) })
      toast.success(`Palette applied: ${data.name}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed')
    }
  }

  async function handleExportZip(blob: Blob, sizes?: ExportSize[]) {
    try {
      await onExportZip(blob)
    } catch (e) {
      console.warn('[export]', e)
    }
  }

  if (!activeSlide) return null

  const slideIdx = project.slides.findIndex(s => s.id === activeSlideId)

  return (
    <>
      {showExport && (
        <ExportPanel
          project={project}
          onExportZip={handleExportZip}
          onClose={() => setShowExport(false)}
        />
      )}

      <div className="flex h-full min-h-0 overflow-hidden">
        {/* ── Left panel ── */}
        <div className="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-4">
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">App</p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-zinc-400">Name</Label>
                <Input value={project.appName} onChange={e => update({ ...project, appName: e.target.value })} className="mt-1 h-8 bg-zinc-900 text-xs border-zinc-700" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Description</Label>
                <Textarea value={project.appDescription} onChange={e => update({ ...project, appDescription: e.target.value })} className="mt-1 min-h-14 bg-zinc-900 text-xs border-zinc-700 resize-none" rows={2} />
              </div>
            </div>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Slide copy</p>
            <div className="space-y-2">
              <div>
                <Label className="text-xs text-zinc-400">Headline</Label>
                <Input value={activeSlide.headline} onChange={e => updateSlide({ headline: e.target.value })} placeholder="Bold benefit" className="mt-1 h-8 bg-zinc-900 text-xs border-zinc-700" />
              </div>
              <div>
                <Label className="text-xs text-zinc-400">Subtext</Label>
                <Input value={activeSlide.subtext} onChange={e => updateSlide({ subtext: e.target.value })} placeholder="Supporting detail" className="mt-1 h-8 bg-zinc-900 text-xs border-zinc-700" />
              </div>
              <Button size="sm" variant="outline" className="w-full h-8 text-xs border-zinc-700 hover:bg-zinc-800" onClick={generateCopy} disabled={generatingCopy}>
                {generatingCopy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-1.5 h-3.5 w-3.5" />}
                AI generate all slides
              </Button>
            </div>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Text position</p>
            <div className="grid grid-cols-3 gap-1">
              {(['top', 'middle', 'bottom'] as TextPosition[]).map(p => (
                <button key={p} onClick={() => updateSlide({ textPosition: p })}
                  className={cn('rounded px-2 py-1.5 text-xs capitalize transition-colors', activeSlide.textPosition === p ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                  {p}
                </button>
              ))}
            </div>
          </section>

          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Text colour</p>
            <div className="grid grid-cols-2 gap-1">
              {(['white', 'dark'] as TextColor[]).map(c => (
                <button key={c} onClick={() => updateSlide({ textColor: c })}
                  className={cn('rounded px-2 py-1.5 text-xs capitalize transition-colors', activeSlide.textColor === c ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                  {c}
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* ── Center panel ── */}
        <div className="flex flex-1 flex-col min-w-0 bg-zinc-950 min-h-0">
          {/* Device tabs */}
          <div className="flex items-center gap-1.5 border-b border-zinc-800 px-3 py-2 overflow-x-auto shrink-0">
            <span className="text-[10px] text-zinc-600 shrink-0 uppercase tracking-wider">Device</span>
            {SIZE_PRESETS.filter(p => !['iPhone 6.7"', 'iPhone 6.1"', 'iPhone 5.5"', 'Google Tablet', 'Watch 49mm', 'Watch 44mm', 'Watch 40mm'].includes(p.label)).map(p => (
              <button key={p.label} onClick={() => setPreset(p)}
                className={cn('shrink-0 rounded px-2 py-1 text-xs transition-colors', preset.label === p.label ? 'bg-violet-600 text-white' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300')}>
                {p.label}
              </button>
            ))}
          </div>

          {/* Canvas */}
          <div className="relative flex flex-1 min-h-0 items-center justify-center overflow-hidden bg-[#080808] p-6">
            <div className="relative" style={{ maxHeight: '100%', maxWidth: '100%', aspectRatio: `${preset.width} / ${preset.height}` }}>
              <canvas ref={mainCanvasRef} style={{ width: '100%', height: '100%', display: 'block', borderRadius: 10 }} />
              {selectingHotspot && (
                <HotspotSelector
                  onSelect={h => { updateSlide({ hotspot: h }); setSelectingHotspot(false) }}
                  existing={activeSlide.hotspot}
                  onClear={() => updateSlide({ hotspot: null })}
                />
              )}
            </div>
          </div>

          {/* Slide strip + export */}
          <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900/60 px-3 py-2.5 overflow-x-auto shrink-0">
            {/* Export button — always visible */}
            <Button
              onClick={() => setShowExport(true)}
              size="sm"
              className="shrink-0 bg-violet-600 hover:bg-violet-500 text-white h-9 px-4 gap-1.5 font-semibold shadow-lg shadow-violet-900/40"
            >
              <Package className="h-4 w-4" />
              Export for App Store
            </Button>

            <div className="h-7 w-px bg-zinc-700 shrink-0" />

            {/* Slides */}
            {project.slides.map((slide, i) => (
              <div key={slide.id} className="relative group shrink-0">
                <SlideMiniCanvas slide={slide} preset={preset} active={slide.id === activeSlideId} onClick={() => setActiveSlideId(slide.id)} />
                {project.slides.length > 1 && (
                  <button onClick={() => removeSlide(slide.id)} className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white">
                    <X className="h-2.5 w-2.5" />
                  </button>
                )}
                <span className="absolute bottom-0.5 left-1 rounded bg-black/60 px-0.5 text-[8px] text-white">{i + 1}</span>
              </div>
            ))}

            {project.slides.length < 10 && (
              <button onClick={addSlide} className="flex h-10 w-7 shrink-0 items-center justify-center rounded border-2 border-dashed border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400 transition-colors">
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button onClick={() => { const p = project.slides[slideIdx - 1]; if (p) setActiveSlideId(p.id) }} disabled={slideIdx === 0}
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 disabled:opacity-30">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-zinc-500 w-10 text-center">{slideIdx + 1}/{project.slides.length}</span>
              <button onClick={() => { const p = project.slides[slideIdx + 1]; if (p) setActiveSlideId(p.id) }} disabled={slideIdx === project.slides.length - 1}
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-800 disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="flex w-60 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-4">
          {/* Upload */}
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Screenshot</p>
            <div
              className={cn('group relative cursor-pointer rounded-xl border-2 border-dashed border-zinc-700 transition-colors hover:border-violet-500/50', activeSlide.screenshotDataUrl ? 'p-2' : 'p-6 text-center')}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f) }}
              onClick={() => fileInputRef.current?.click()}
            >
              {activeSlide.screenshotDataUrl ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={activeSlide.screenshotDataUrl} alt="" className="h-12 w-auto rounded border border-zinc-700 object-cover" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-zinc-300 truncate">Loaded</p>
                    <p className="text-xs text-zinc-500">Click to replace</p>
                  </div>
                  <button onClick={e => { e.stopPropagation(); updateSlide({ screenshotDataUrl: null }) }} className="text-zinc-500 hover:text-red-400">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto mb-2 h-6 w-6 text-zinc-600 group-hover:text-violet-400" />
                  <p className="text-xs text-zinc-500">Drop or click</p>
                </>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} />
          </section>

          {/* Area pop */}
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Area pop</p>
            <p className="mb-1.5 text-xs text-zinc-500 leading-relaxed">
              Select a region to lift out in 3D — dims everything else and pops the area to stand out in the App Store.
            </p>
            <Button size="sm" variant={selectingHotspot ? 'default' : 'outline'}
              className={cn('w-full h-8 text-xs', selectingHotspot ? 'bg-yellow-600 hover:bg-yellow-500 border-0' : 'border-zinc-700 hover:bg-zinc-800')}
              onClick={() => setSelectingHotspot(v => !v)}>
              <Move className="mr-1.5 h-3.5 w-3.5" />
              {selectingHotspot ? 'Drag on preview to select' : 'Select area to pop'}
            </Button>
            {activeSlide.hotspot && (
              <button className="mt-1.5 w-full text-xs text-red-400 hover:text-red-300" onClick={() => updateSlide({ hotspot: null })}>
                Remove pop
              </button>
            )}
          </section>

          {/* Effect */}
          <section>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Phone effect</p>
            <div className="grid grid-cols-2 gap-1">
              {(['none', 'float', 'tilt', 'glow'] as ScreenshotEffect[]).map(ef => (
                <button key={ef} onClick={() => updateSlide({ screenshotEffect: ef })}
                  className={cn('rounded px-2 py-1.5 text-xs capitalize transition-colors', activeSlide.screenshotEffect === ef ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                  {ef}
                </button>
              ))}
            </div>
          </section>

          {/* Background */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Background</p>
              <Button size="sm" variant="ghost" className="h-6 px-2 text-xs text-violet-400 hover:text-violet-300 hover:bg-zinc-800" onClick={suggestPalette}>
                <Sparkles className="mr-1 h-3 w-3" />AI
              </Button>
            </div>

            {/* Type */}
            <div className="grid grid-cols-3 gap-1 mb-2.5">
              {(['solid', 'gradient', 'split'] as const).map(t => (
                <button key={t} onClick={() => updateSlide({ background: { ...activeSlide.background, type: t } })}
                  className={cn('rounded px-1.5 py-1 text-xs capitalize transition-colors', activeSlide.background.type === t ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700')}>
                  {t}
                </button>
              ))}
            </div>

            {/* Swatches */}
            <div className="grid grid-cols-4 gap-1.5 mb-2.5">
              {COLOR_PRESETS.map((bg, i) => {
                const style = bg.type === 'solid'
                  ? { background: bg.colors[0] }
                  : bg.type === 'split'
                  ? { background: `linear-gradient(135deg, ${bg.colors[0]} 50%, ${bg.colors[1]} 50%)` }
                  : { background: `linear-gradient(${bg.angle}deg, ${bg.colors[0]}, ${bg.colors[1]})` }
                return (
                  <button key={i} onClick={() => updateSlide({ background: bg })}
                    className={cn('h-9 w-full rounded-lg border-2 transition-all', JSON.stringify(activeSlide.background) === JSON.stringify(bg) ? 'border-violet-400 scale-105' : 'border-transparent hover:border-zinc-600')}
                    style={style}
                  />
                )
              })}
            </div>

            {/* Custom colors */}
            <div className="space-y-1.5">
              {[0, 1].map(idx => {
                if (idx === 1 && activeSlide.background.type === 'solid') return null
                return (
                  <div key={idx} className="flex items-center gap-2">
                    <label className="text-xs text-zinc-500 w-10 shrink-0">{idx === 0 ? 'Col 1' : 'Col 2'}</label>
                    <input type="color" value={activeSlide.background.colors[idx] ?? '#3b0764'}
                      onChange={e => {
                        const c = [...activeSlide.background.colors]
                        c[idx] = e.target.value
                        updateSlide({ background: { ...activeSlide.background, colors: c } })
                      }}
                      className="h-7 w-7 shrink-0 cursor-pointer rounded border border-zinc-700 bg-transparent p-0.5"
                    />
                    <Input value={activeSlide.background.colors[idx] ?? ''}
                      onChange={e => {
                        const c = [...activeSlide.background.colors]
                        c[idx] = e.target.value
                        updateSlide({ background: { ...activeSlide.background, colors: c } })
                      }}
                      className="h-7 flex-1 bg-zinc-900 text-xs font-mono border-zinc-700"
                    />
                  </div>
                )
              })}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
