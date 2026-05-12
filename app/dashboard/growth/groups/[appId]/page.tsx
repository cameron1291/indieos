'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Loader2, Plus, X, ExternalLink, Wand2 } from 'lucide-react'
import type { App } from '@/types/database'

interface SearchTerm {
  term: string
  rationale: string
}

export default function GroupFinderPage() {
  const params = useParams()
  const appId = params.appId as string
  const [app, setApp] = useState<App | null>(null)
  const [groups, setGroups] = useState<string[]>([])
  const [newGroup, setNewGroup] = useState('')
  const [searchTerms, setSearchTerms] = useState<SearchTerm[]>([])
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

  useEffect(() => {
    supabase.from('apps').select('*').eq('id', appId).single().then(({ data }) => {
      if (data) {
        setApp(data as App)
        setGroups((data as App).facebook_groups ?? [])
      }
    })
  }, [appId])

  async function generateSearchTerms() {
    setGenerating(true)
    try {
      const res = await fetch('/api/apps/find-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: appId }),
      })
      if (!res.ok) throw new Error('Failed')
      const { terms } = await res.json()
      setSearchTerms(terms ?? [])
      toast.success(`${terms?.length ?? 0} search terms generated`)
    } catch {
      toast.error('Failed to generate search terms')
    } finally {
      setGenerating(false)
    }
  }

  function addGroup(url: string) {
    const trimmed = url.trim()
    if (!trimmed || groups.includes(trimmed)) return
    setGroups(prev => [...prev, trimmed])
    setNewGroup('')
  }

  function removeGroup(url: string) {
    setGroups(prev => prev.filter(g => g !== url))
  }

  async function saveGroups() {
    setSaving(true)
    await supabase.from('apps').update({ facebook_groups: groups }).eq('id', appId)
    toast.success('Groups saved')
    setSaving(false)
  }

  if (!app) return (
    <div className="flex items-center justify-center p-16 text-zinc-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Facebook groups</h1>
        <p className="mt-1 text-sm text-zinc-500">{app.name}</p>
      </div>

      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        Join these groups in Facebook first, then add them here. The crawler only reads groups you are a member of.
      </div>

      {/* Current groups */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div>
            <CardTitle>Monitored groups</CardTitle>
            <CardDescription>{groups.length} group{groups.length !== 1 ? 's' : ''}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {groups.length === 0 && (
            <p className="text-sm text-zinc-500">No groups added yet.</p>
          )}
          {groups.map(url => (
            <div key={url} className="flex items-center gap-2 rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
              <ExternalLink className="h-4 w-4 shrink-0 text-blue-600" />
              <span className="flex-1 truncate text-sm">{url}</span>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="ghost"><ExternalLink className="h-3.5 w-3.5" /></Button>
              </a>
              <Button size="sm" variant="ghost" onClick={() => removeGroup(url)}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}

          {/* Add manually */}
          <div className="flex gap-2 pt-1">
            <Input
              placeholder="https://www.facebook.com/groups/…"
              value={newGroup}
              onChange={e => setNewGroup(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGroup(newGroup) } }}
              className="flex-1 text-sm"
            />
            <Button variant="outline" size="icon" onClick={() => addGroup(newGroup)}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <Button onClick={saveGroups} disabled={saving} className="w-full">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Save groups
          </Button>
        </CardContent>
      </Card>

      {/* Group finder */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Find new groups</CardTitle>
            <CardDescription>AI generates search terms — search Facebook, then add the groups above.</CardDescription>
          </div>
          <Button size="sm" variant="outline" onClick={generateSearchTerms} disabled={generating}>
            {generating
              ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
              : <Wand2 className="mr-2 h-3.5 w-3.5" />}
            {generating ? 'Generating…' : 'Generate terms'}
          </Button>
        </CardHeader>
        {searchTerms.length > 0 && (
          <CardContent>
            <div className="space-y-2">
              {searchTerms.map((t, i) => (
                <div key={i} className="flex items-start gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{t.term}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">{t.rationale}</p>
                  </div>
                  <a
                    href={`https://www.facebook.com/search/groups/?q=${encodeURIComponent(t.term)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button size="sm" variant="outline">
                      Search <ExternalLink className="ml-1.5 h-3 w-3" />
                    </Button>
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
