'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  Wand2, Download, Loader2, Upload, Plus, Trash2, X,
  ChevronLeft, ChevronRight, ZoomIn, Palette, Image as ImageIcon,
  Sparkles, Move
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

import type { Slide, ScreenshotProject, SizePreset, Background, ScreenshotEffect, TextColor, TextPosition } from '@/lib/screenshots/types'
import { SIZE_PRESETS, COLOR_PRESETS } from '@/lib/screenshots/presets'
import { renderToCanvas, preloadImage } from '@/lib/screenshots/canvas-renderer'
import { createDefaultSlide } from '@/lib/screenshots/projects'
import { downloadZip } from '@/lib/screenshots/exporter'

// ─── Mini canvas for slide strip ──────────────────────────────────────────────

function SlideMiniCanvas({
  slide,
  preset,
  active,
  onClick,
}: {
  slide: Slide
  preset: SizePreset
  active: boolean
  onClick: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const render = () => {
      if (slide.screenshotDataUrl) {
        preloadImage(slide.screenshotDataUrl).then(() => {
          if (canvasRef.current) renderToCanvas(canvasRef.current, slide, preset)
        })
      } else {
        renderToCanvas(canvas, slide, preset)
      }
    }
    render()
  }, [slide, preset])

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative shrink-0 overflow-hidden rounded-lg border-2 transition-all',
        active ? 'border-violet-500 shadow-lg shadow-violet-500/30' : 'border-zinc-700 hover:border-zinc-500',
      )}
      style={{ width: 56, height: Math.round(56 * (preset.height / preset.width)) }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </button>
  )
}

// ─── Hotspot selector overlay ─────────────────────────────────────────────────

function HotspotSelector({
  onSelect,
  existing,
  onClear,
}: {
  onSelect: (h: { x: number; y: number; w: number; h: number }) => void
  existing: { x: number; y: number; w: number; h: number } | null
  onClear: () => void
}) {
  const overlayRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)
  const [start, setStart] = useState({ x: 0, y: 0 })
  const [current, setCurrent] = useState({ x: 0, y: 0 })

  function getRelPos(e: React.MouseEvent) {
    const rect = overlayRef.current!.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  function onMouseDown(e: React.MouseEvent) {
    const p = getRelPos(e)
    setStart(p)
    setCurrent(p)
    setDragging(true)
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!dragging) return
    setCurrent(getRelPos(e))
  }

  function onMouseUp() {
    if (!dragging) return
    setDragging(false)
    const x = Math.min(start.x, current.x)
    const y = Math.min(start.y, current.y)
    const w = Math.abs(current.x - start.x)
    const h = Math.abs(current.y - start.y)
    if (w > 0.02 && h > 0.02) onSelect({ x, y, w, h })
  }

  const selX = Math.min(start.x, current.x)
  const selY = Math.min(start.y, current.y)
  const selW = Math.abs(current.x - start.x)
  const selH = Math.abs(current.y - start.y)

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 cursor-crosshair"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
    >
      {dragging && selW > 0.02 && selH > 0.02 && (
        <div
          className="absolute border-2 border-yellow-400 bg-yellow-400/20"
          style={{
            left: `${selX * 100}%`,
            top: `${selY * 100}%`,
            width: `${selW * 100}%`,
            height: `${selH * 100}%`,
          }}
        />
      )}
      {existing && !dragging && (
        <div
          className="absolute border-2 border-yellow-400 bg-yellow-400/20"
          style={{
            left: `${existing.x * 100}%`,
            top: `${existing.y * 100}%`,
            width: `${existing.w * 100}%`,
            height: `${existing.h * 100}%`,
          }}
        >
          <button
            className="absolute -top-3 -right-3 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white"
            onClick={e => { e.stopPropagation(); onClear() }}
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

interface ScreenshotEditorProps {
  project: ScreenshotProject
  onChange: (project: ScreenshotProject) => void
  onExportZip: (blob: Blob, preset: SizePreset) => Promise<void>
}

export default function ScreenshotEditor({ project, onChange, onExportZip }: ScreenshotEditorProps) {
  const [activeSlideId, setActiveSlideId] = useState(project.activeSlideId)
  const [preset, setPreset] = useState<SizePreset>(SIZE_PRESETS[0])
  const [selectingHotspot, setSelectingHotspot] = useState(false)
  const [generatingCopy, setGeneratingCopy] = useState(false)
  const [exporting, setExporting] = useState(false)
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

  // Render main canvas whenever active slide or preset changes
  useEffect(() => {
    const canvas = mainCanvasRef.current
    if (!canvas || !activeSlide) return

    const render = () => renderToCanvas(canvas, activeSlide, preset)

    if (activeSlide.screenshotDataUrl) {
      preloadImage(activeSlide.screenshotDataUrl).then(render)
    } else {
      render()
    }
  }, [activeSlide, preset])

  // ── Slide management ────────────────────────────────────────────────────────

  function addSlide() {
    const slide = createDefaultSlide({
      background: activeSlide?.background ?? { type: 'gradient', colors: ['#3b0764', '#7c3aed'], angle: 145 },
      textColor: activeSlide?.textColor ?? 'white',
      textPosition: activeSlide?.textPosition ?? 'top',
      screenshotEffect: activeSlide?.screenshotEffect ?? 'float',
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

  // ── Screenshot upload ────────────────────────────────────────────────────────

  async function handleFileUpload(file: File) {
    if (!file.type.startsWith('image/')) { toast.error('Please upload an image file'); return }
    const reader = new FileReader()
    reader.onload = e => {
      const dataUrl = e.target?.result as string
      updateSlide({ screenshotDataUrl: dataUrl })
    }
    reader.readAsDataURL(file)
  }

  function onDropFile(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileUpload(file)
  }

  // ── AI copy generation ───────────────────────────────────────────────────────

  async function generateCopy() {
    if (!project.appName) { toast.error('App name required'); return }
    setGeneratingCopy(true)
    try {
      const res = await fetch('/api/screenshots/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appName: project.appName,
          appDescription: project.appDescription,
          slideCount: project.slides.length,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      const generated: Array<{ headline: string; subtext: string }> = data.slides ?? []
      update({
        ...project,
        slides: project.slides.map((s, i) => ({
          ...s,
          ...(generated[i] ?? {}),
        })),
      })
      toast.success('Copy generated')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to generate copy')
    } finally {
      setGeneratingCopy(false)
    }
  }

  // ── AI palette suggestion ────────────────────────────────────────────────────

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
      update({
        ...project,
        slides: project.slides.map(s => ({ ...s, background: bg })),
      })
      toast.success(`Palette applied: ${data.name}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to suggest palette')
    }
  }

  // ── Export ───────────────────────────────────────────────────────────────────

  async function handleExport() {
    setExporting(true)
    try {
      const blob = await downloadZip(project.slides, preset, project.appName)
      await onExportZip(blob, preset)
      toast.success('Export ready — downloading ZIP')
      // Also trigger local download
      const { saveAs } = await import('file-saver')
      const safe = project.appName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
      saveAs(blob, `${safe}_screenshots.zip`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  if (!activeSlide) return null

  const slideIdx = project.slides.findIndex(s => s.id === activeSlideId)

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* ── Left panel ── */}
      <div className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">App info</p>
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-zinc-400">App name</Label>
              <Input
                value={project.appName}
                onChange={e => update({ ...project, appName: e.target.value })}
                className="mt-1 h-8 bg-zinc-900 text-xs border-zinc-700"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Description</Label>
              <Textarea
                value={project.appDescription}
                onChange={e => update({ ...project, appDescription: e.target.value })}
                className="mt-1 min-h-16 bg-zinc-900 text-xs border-zinc-700 resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Slide content</p>
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-zinc-400">Headline</Label>
              <Input
                value={activeSlide.headline}
                onChange={e => updateSlide({ headline: e.target.value })}
                placeholder="Bold benefit statement"
                className="mt-1 h-8 bg-zinc-900 text-xs border-zinc-700"
              />
            </div>
            <div>
              <Label className="text-xs text-zinc-400">Subtext</Label>
              <Input
                value={activeSlide.subtext}
                onChange={e => updateSlide({ subtext: e.target.value })}
                placeholder="Supporting detail"
                className="mt-1 h-8 bg-zinc-900 text-xs border-zinc-700"
              />
            </div>
            <Button
              size="sm"
              variant="outline"
              className="w-full h-8 text-xs border-zinc-700 hover:bg-zinc-800"
              onClick={generateCopy}
              disabled={generatingCopy}
            >
              {generatingCopy
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Wand2 className="mr-1.5 h-3.5 w-3.5" />
              }
              AI generate copy
            </Button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Text</p>
          <div className="space-y-2">
            <div>
              <Label className="text-xs text-zinc-400 mb-1 block">Position</Label>
              <div className="grid grid-cols-3 gap-1">
                {(['top', 'middle', 'bottom'] as TextPosition[]).map(p => (
                  <button
                    key={p}
                    onClick={() => updateSlide({ textPosition: p })}
                    className={cn(
                      'rounded px-2 py-1 text-xs capitalize transition-colors',
                      activeSlide.textPosition === p
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs text-zinc-400 mb-1 block">Color</Label>
              <div className="grid grid-cols-2 gap-1">
                {(['white', 'dark'] as TextColor[]).map(c => (
                  <button
                    key={c}
                    onClick={() => updateSlide({ textColor: c })}
                    className={cn(
                      'rounded px-2 py-1 text-xs capitalize transition-colors',
                      activeSlide.textColor === c
                        ? 'bg-violet-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                    )}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Center panel ── */}
      <div className="flex flex-1 flex-col min-w-0 bg-zinc-950">
        {/* Device selector */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2 overflow-x-auto">
          <span className="text-xs text-zinc-500 shrink-0">Device:</span>
          {SIZE_PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => setPreset(p)}
              className={cn(
                'shrink-0 rounded-md px-2.5 py-1 text-xs transition-colors',
                preset.label === p.label
                  ? 'bg-violet-600 text-white'
                  : 'text-zinc-400 hover:bg-zinc-800',
              )}
            >
              {p.label}
            </button>
          ))}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs border-zinc-700 hover:bg-zinc-800"
              onClick={handleExport}
              disabled={exporting}
            >
              {exporting
                ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                : <Download className="mr-1.5 h-3.5 w-3.5" />
              }
              Export ZIP
            </Button>
          </div>
        </div>

        {/* Canvas preview */}
        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0a0a0a] p-4">
          <div
            className="relative"
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              aspectRatio: `${preset.width} / ${preset.height}`,
            }}
          >
            <canvas
              ref={mainCanvasRef}
              style={{ width: '100%', height: '100%', display: 'block', borderRadius: 12 }}
            />
            {selectingHotspot && (
              <HotspotSelector
                onSelect={h => { updateSlide({ hotspot: h }); setSelectingHotspot(false) }}
                existing={activeSlide.hotspot}
                onClear={() => updateSlide({ hotspot: null })}
              />
            )}
          </div>
        </div>

        {/* Slide strip */}
        <div className="flex items-center gap-2 border-t border-zinc-800 bg-zinc-900/60 px-4 py-3 overflow-x-auto">
          {project.slides.map((slide, i) => (
            <div key={slide.id} className="relative group shrink-0">
              <SlideMiniCanvas
                slide={slide}
                preset={preset}
                active={slide.id === activeSlideId}
                onClick={() => setActiveSlideId(slide.id)}
              />
              {project.slides.length > 1 && (
                <button
                  onClick={() => removeSlide(slide.id)}
                  className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1 text-[9px] text-white">{i + 1}</span>
            </div>
          ))}
          {project.slides.length < 10 && (
            <button
              onClick={addSlide}
              className="flex h-14 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-zinc-700 text-zinc-600 hover:border-zinc-500 hover:text-zinc-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          {/* Navigation */}
          <div className="ml-auto flex shrink-0 items-center gap-1">
            <button
              onClick={() => {
                const prev = project.slides[slideIdx - 1]
                if (prev) setActiveSlideId(prev.id)
              }}
              disabled={slideIdx === 0}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs text-zinc-500">{slideIdx + 1}/{project.slides.length}</span>
            <button
              onClick={() => {
                const next = project.slides[slideIdx + 1]
                if (next) setActiveSlideId(next.id)
              }}
              disabled={slideIdx === project.slides.length - 1}
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-800 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-4">
        {/* Screenshot upload */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Screenshot</p>
          <div
            className={cn(
              'group relative cursor-pointer rounded-xl border-2 border-dashed border-zinc-700 p-4 text-center transition-colors hover:border-violet-500/50',
              activeSlide.screenshotDataUrl ? 'py-2' : 'py-8',
            )}
            onDragOver={e => e.preventDefault()}
            onDrop={onDropFile}
            onClick={() => fileInputRef.current?.click()}
          >
            {activeSlide.screenshotDataUrl ? (
              <div className="flex items-center justify-between gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={activeSlide.screenshotDataUrl}
                  alt=""
                  className="h-12 w-auto rounded border border-zinc-700 object-cover"
                />
                <div className="flex-1 text-left">
                  <p className="text-xs text-zinc-300">Screenshot loaded</p>
                  <p className="text-xs text-zinc-500">Click to replace</p>
                </div>
                <button
                  onClick={e => { e.stopPropagation(); updateSlide({ screenshotDataUrl: null }) }}
                  className="text-zinc-500 hover:text-red-400"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="mx-auto mb-2 h-6 w-6 text-zinc-600 group-hover:text-violet-400 transition-colors" />
                <p className="text-xs text-zinc-500">Drop or click to upload</p>
                <p className="text-xs text-zinc-600 mt-1">PNG, JPG, WEBP</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }}
          />
        </div>

        {/* Area pop */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Area pop</p>
          <p className="mb-2 text-xs text-zinc-500">Select a region to pop in 3D</p>
          <Button
            size="sm"
            variant={selectingHotspot ? 'default' : 'outline'}
            className={cn(
              'w-full h-8 text-xs',
              selectingHotspot ? 'bg-yellow-600 hover:bg-yellow-500 border-0' : 'border-zinc-700 hover:bg-zinc-800',
            )}
            onClick={() => setSelectingHotspot(v => !v)}
          >
            <Move className="mr-1.5 h-3.5 w-3.5" />
            {selectingHotspot ? 'Click & drag on preview' : 'Select area'}
          </Button>
          {activeSlide.hotspot && (
            <button
              className="mt-1.5 w-full text-xs text-red-400 hover:text-red-300"
              onClick={() => updateSlide({ hotspot: null })}
            >
              Clear area pop
            </button>
          )}
        </div>

        {/* Effect */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">Phone effect</p>
          <div className="grid grid-cols-2 gap-1">
            {(['none', 'float', 'tilt', 'glow'] as ScreenshotEffect[]).map(ef => (
              <button
                key={ef}
                onClick={() => updateSlide({ screenshotEffect: ef })}
                className={cn(
                  'rounded px-2 py-1.5 text-xs capitalize transition-colors',
                  activeSlide.screenshotEffect === ef
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                )}
              >
                {ef}
              </button>
            ))}
          </div>
        </div>

        {/* Background */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">Background</p>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-xs text-violet-400 hover:text-violet-300 hover:bg-zinc-800"
              onClick={suggestPalette}
            >
              <Sparkles className="mr-1 h-3 w-3" />
              AI pick
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {COLOR_PRESETS.map((bg, i) => {
              const isActive = JSON.stringify(activeSlide.background) === JSON.stringify(bg)
              const style =
                bg.type === 'solid'
                  ? { background: bg.colors[0] }
                  : bg.type === 'split'
                  ? { background: `linear-gradient(to bottom, ${bg.colors[0]} 50%, ${bg.colors[1]} 50%)` }
                  : { background: `linear-gradient(${bg.angle}deg, ${bg.colors[0]}, ${bg.colors[1]})` }
              return (
                <button
                  key={i}
                  onClick={() => updateSlide({ background: bg })}
                  className={cn(
                    'h-10 w-full rounded-lg border-2 transition-all',
                    isActive ? 'border-violet-400 scale-105' : 'border-transparent hover:border-zinc-600',
                  )}
                  style={style}
                />
              )
            })}
          </div>

          {/* Custom color inputs */}
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs text-zinc-500 w-12">Color 1</label>
              <input
                type="color"
                value={activeSlide.background.colors[0] ?? '#3b0764'}
                onChange={e => updateSlide({ background: { ...activeSlide.background, colors: [e.target.value, activeSlide.background.colors[1] ?? '#7c3aed'] } })}
                className="h-7 w-7 cursor-pointer rounded border border-zinc-700 bg-transparent p-0.5"
              />
              <Input
                value={activeSlide.background.colors[0] ?? ''}
                onChange={e => updateSlide({ background: { ...activeSlide.background, colors: [e.target.value, activeSlide.background.colors[1] ?? '#7c3aed'] } })}
                className="h-7 flex-1 bg-zinc-900 text-xs font-mono border-zinc-700"
              />
            </div>
            {activeSlide.background.type !== 'solid' && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-zinc-500 w-12">Color 2</label>
                <input
                  type="color"
                  value={activeSlide.background.colors[1] ?? '#7c3aed'}
                  onChange={e => updateSlide({ background: { ...activeSlide.background, colors: [activeSlide.background.colors[0] ?? '#3b0764', e.target.value] } })}
                  className="h-7 w-7 cursor-pointer rounded border border-zinc-700 bg-transparent p-0.5"
                />
                <Input
                  value={activeSlide.background.colors[1] ?? ''}
                  onChange={e => updateSlide({ background: { ...activeSlide.background, colors: [activeSlide.background.colors[0] ?? '#3b0764', e.target.value] } })}
                  className="h-7 flex-1 bg-zinc-900 text-xs font-mono border-zinc-700"
                />
              </div>
            )}
          </div>

          {/* Background type */}
          <div className="mt-2 grid grid-cols-3 gap-1">
            {(['solid', 'gradient', 'split'] as const).map(t => (
              <button
                key={t}
                onClick={() => updateSlide({ background: { ...activeSlide.background, type: t } })}
                className={cn(
                  'rounded px-2 py-1 text-xs capitalize transition-colors',
                  activeSlide.background.type === t
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700',
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
