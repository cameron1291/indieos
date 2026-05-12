'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Search, Plus, X, ExternalLink, CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface DomainResult {
  tld: string
  available: boolean | null
  error?: string
}

interface NameResult {
  name: string
  domains: DomainResult[]
  app_store_url: string
  play_store_url: string
}

export default function NamesPage() {
  const [input, setInput] = useState('')
  const [names, setNames] = useState<string[]>([])
  const [results, setResults] = useState<NameResult[]>([])
  const [loading, setLoading] = useState(false)

  function addName() {
    const trimmed = input.trim()
    if (!trimmed || names.includes(trimmed) || names.length >= 10) return
    setNames(prev => [...prev, trimmed])
    setInput('')
  }

  function removeName(n: string) {
    setNames(prev => prev.filter(x => x !== n))
  }

  async function check() {
    if (!names.length) { toast.error('Add at least one name'); return }
    setLoading(true)
    setResults([])
    try {
      const res = await fetch('/api/name-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names }),
      })
      if (!res.ok) throw new Error()
      const { results: r } = await res.json()
      setResults(r ?? [])
    } catch {
      toast.error('Check failed')
    } finally {
      setLoading(false)
    }
  }

  function domainIcon(d: DomainResult) {
    if (d.available === true) return <CheckCircle2 className="h-4 w-4 text-green-500" />
    if (d.available === false) return <XCircle className="h-4 w-4 text-red-400" />
    return <HelpCircle className="h-4 w-4 text-zinc-300" />
  }

  function domainBadge(d: DomainResult) {
    if (d.available === true) return 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
    if (d.available === false) return 'bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400'
    return 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Name & domain checker</h1>
        <p className="mt-1 text-sm text-zinc-500">Check domain availability and App Store search for up to 10 names at once.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <Label>App names to check</Label>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. Tradie Invoice, InvoiceQuick…"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addName()}
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={addName} disabled={!input.trim() || names.length >= 10}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-zinc-400">Press Enter or click + to add. Max 10 names.</p>
          </div>

          {names.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {names.map(n => (
                <div key={n} className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-sm dark:bg-zinc-800">
                  {n}
                  <button onClick={() => removeName(n)} className="text-zinc-400 hover:text-zinc-700">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <Button onClick={check} disabled={loading || !names.length} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            {loading ? `Checking ${names.length} names…` : `Check ${names.length} name${names.length !== 1 ? 's' : ''}`}
          </Button>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <div className="space-y-4">
          {results.map(r => {
            const availableDomains = r.domains.filter(d => d.available === true).length
            const slug = r.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
            return (
              <Card key={r.name}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{r.name}</CardTitle>
                    <Badge variant={availableDomains > 0 ? 'default' : 'secondary'} className={availableDomains > 0 ? 'bg-green-600' : ''}>
                      {availableDomains}/{r.domains.length} domains free
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Domains */}
                  <div className="grid grid-cols-4 gap-2">
                    {r.domains.map(d => (
                      <a
                        key={d.tld}
                        href={`https://www.namecheap.com/domains/registration/results/?domain=${slug.replace(/-/g, '') + d.tld}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn('flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-sm transition-colors hover:opacity-80', domainBadge(d))}
                      >
                        {domainIcon(d)}
                        <span className="font-medium">{d.tld}</span>
                        <span className="text-xs opacity-70">
                          {d.available === true ? 'free' : d.available === false ? 'taken' : '?'}
                        </span>
                      </a>
                    ))}
                  </div>

                  {/* Store search links */}
                  <div className="flex gap-2 pt-1">
                    <a href={r.app_store_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> App Store search
                      </Button>
                    </a>
                    <a href={r.play_store_url} target="_blank" rel="noopener noreferrer">
                      <Button size="sm" variant="outline">
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" /> Play Store search
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
