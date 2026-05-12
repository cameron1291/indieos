'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2, Wand2, ExternalLink, Copy, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { App } from '@/types/database'

const DOC_TYPES = [
  { id: 'privacy', label: 'Privacy Policy', description: 'Required for App Store & Play Store' },
  { id: 'terms', label: 'Terms of Service', description: 'User agreement for your app' },
  { id: 'eula', label: 'EULA', description: 'End User License Agreement' },
]

interface LegalDoc {
  doc_type: string
  content: string
}

export default function LegalPage() {
  const params = useParams()
  const appId = params.appId as string
  const [app, setApp] = useState<App | null>(null)
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [docs, setDocs] = useState<Record<string, string>>({})
  const [generating, setGenerating] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('privacy')

  useEffect(() => {
    const supabase = createClient()
    supabase.from('apps').select('*').eq('id', appId).single()
      .then(({ data }) => {
        if (data) {
          setApp(data as App)
          setWebsite((data as App).website_url ?? '')
        }
      })
    supabase.from('legal_docs').select('*').eq('app_id', appId)
      .then(({ data }) => {
        if (data) {
          const map: Record<string, string> = {}
          for (const d of data as LegalDoc[]) map[d.doc_type] = d.content
          setDocs(map)
        }
      })
  }, [appId])

  async function generate(docType: string) {
    if (!app) return
    setGenerating(docType)
    try {
      const res = await fetch('/api/legal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app_id: appId,
          doc_type: docType,
          app_name: app.name,
          description: app.description,
          company: company || app.name,
          email,
          website,
        }),
      })
      if (!res.ok) throw new Error()
      const { content } = await res.json()
      setDocs(prev => ({ ...prev, [docType]: content }))
      toast.success(`${DOC_TYPES.find(d => d.id === docType)?.label} generated`)
    } catch {
      toast.error('Failed to generate document')
    } finally {
      setGenerating(null)
    }
  }

  async function generateAll() {
    for (const { id } of DOC_TYPES) {
      await generate(id)
    }
  }

  function publicUrl(docType: string) {
    return `${window.location.origin}/legal/${appId}/${docType}`
  }

  async function copyUrl(docType: string) {
    await navigator.clipboard.writeText(publicUrl(docType))
    toast.success('URL copied')
  }

  if (!app) return (
    <div className="flex items-center justify-center p-16">
      <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
    </div>
  )

  const activeDoc = docs[activeTab]

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Legal documents</h1>
        <p className="mt-1 text-sm text-zinc-500">{app.name}</p>
      </div>

      {/* Contact info */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Document details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Company / developer name</Label>
            <Input placeholder={app.name} value={company} onChange={e => setCompany(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Contact email</Label>
            <Input type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input placeholder="https://example.com" value={website} onChange={e => setWebsite(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      {/* Doc type tabs + generate buttons */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          {DOC_TYPES.map(dt => (
            <button
              key={dt.id}
              onClick={() => setActiveTab(dt.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm transition-colors',
                activeTab === dt.id ? 'bg-white shadow font-medium dark:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              {dt.label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={generateAll} disabled={!!generating}>
          {generating ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Wand2 className="mr-2 h-3.5 w-3.5" />}
          Generate all
        </Button>
      </div>

      {/* Active doc */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base">{DOC_TYPES.find(d => d.id === activeTab)?.label}</CardTitle>
            <p className="text-xs text-zinc-500 mt-0.5">{DOC_TYPES.find(d => d.id === activeTab)?.description}</p>
          </div>
          <div className="flex gap-2">
            {activeDoc && (
              <>
                <Button size="sm" variant="outline" onClick={() => copyUrl(activeTab)}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy URL
                </Button>
                <a href={`/legal/${appId}/${activeTab}`} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant="outline">
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Preview
                  </Button>
                </a>
              </>
            )}
            <Button size="sm" onClick={() => generate(activeTab)} disabled={!!generating}>
              {generating === activeTab ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
              {activeDoc ? 'Regenerate' : 'Generate'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activeDoc ? (
            <Textarea
              value={activeDoc}
              onChange={e => setDocs(prev => ({ ...prev, [activeTab]: e.target.value }))}
              rows={24}
              className="font-mono text-xs"
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Wand2 className="h-8 w-8 text-zinc-300 mb-3" />
              <p className="text-sm text-zinc-500">Click Generate to create your {DOC_TYPES.find(d => d.id === activeTab)?.label}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
