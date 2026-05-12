'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import Link from 'next/link'
import { ArrowLeft, Loader2 } from 'lucide-react'

import { createClient } from '@/lib/supabase'
import type { App } from '@/types/database'
import type { ScreenshotProject, SizePreset } from '@/lib/screenshots/types'
import { createDefaultProject } from '@/lib/screenshots/projects'
import ScreenshotEditor from '@/components/screenshots/ScreenshotEditor'

const STORAGE_KEY_PREFIX = 'screenshot-project-'
const SAVE_DEBOUNCE = 1200

export default function ScreenshotsPage() {
  const params = useParams()
  const appId = params.appId as string
  const [app, setApp] = useState<App | null>(null)
  const [project, setProject] = useState<ScreenshotProject | null>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load app + project
  useEffect(() => {
    const supabase = createClient()
    supabase.from('apps').select('*').eq('id', appId).single().then(({ data }) => {
      if (!data) return
      setApp(data as App)

      // Try localStorage first
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${appId}`)
      if (saved) {
        try {
          setProject(JSON.parse(saved))
          return
        } catch {}
      }

      // Create new project
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) return
        const proj = createDefaultProject(appId, user.id, data.name, data.description ?? '')
        setProject(proj)
      })
    })
  }, [appId])

  // Debounced save to localStorage
  const handleChange = useCallback((updated: ScreenshotProject) => {
    setProject(updated)
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${appId}`, JSON.stringify(updated))
    }, SAVE_DEBOUNCE)
  }, [appId])

  // Upload ZIP to Supabase Storage
  async function handleExportZip(blob: Blob, _preset?: SizePreset): Promise<void> {
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const path = `screenshots/${user.id}/${appId}/exports/screenshots-${Date.now()}.zip`
      const arr = await blob.arrayBuffer()
      const { error } = await supabase.storage.from('app-assets').upload(path, arr, {
        contentType: 'application/zip',
        upsert: true,
      })
      if (error) throw error

      const { data: { publicUrl } } = supabase.storage.from('app-assets').getPublicUrl(path)
      toast.success(
        <span>
          Saved to cloud.{' '}
          <a href={publicUrl} target="_blank" rel="noreferrer" className="underline">
            Download backup
          </a>
        </span>,
      )
    } catch (e) {
      // Non-fatal — local download already triggered in editor
      console.warn('[screenshots/export]', e)
    }
  }

  if (!app || !project) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 border-b border-zinc-800 bg-zinc-900 px-4 py-3">
        <Link
          href="/dashboard/prep"
          className="flex items-center gap-1.5 text-sm text-zinc-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          App Store Prep
        </Link>
        <span className="text-zinc-700">/</span>
        <div>
          <span className="text-sm font-medium text-white">Screenshot generator</span>
          <span className="ml-2 text-sm text-zinc-500">· {app.name}</span>
        </div>
      </div>

      {/* Editor fills remaining height */}
      <div className="flex-1 min-h-0">
        <ScreenshotEditor
          project={project}
          onChange={handleChange}
          onExportZip={handleExportZip}
        />
      </div>
    </div>
  )
}
