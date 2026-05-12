'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ExternalLink, Bell, Loader2 } from 'lucide-react'
import type { Opportunity } from '@/types/database'

export default function PostedPage() {
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [replyUrls, setReplyUrls] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const supabase = createClient()

  useEffect(() => {
    supabase
      .from('opportunities')
      .select('*')
      .eq('status', 'posted')
      .order('posted_at', { ascending: false })
      .then(({ data }) => {
        setOpps((data ?? []) as Opportunity[])
        const urls: Record<string, string> = {}
        for (const o of data ?? []) {
          if (o.reply_url) urls[o.id] = o.reply_url
        }
        setReplyUrls(urls)
        setLoading(false)
      })
  }, [])

  async function saveReplyUrl(id: string) {
    setSaving(prev => ({ ...prev, [id]: true }))
    await supabase.from('opportunities').update({ reply_url: replyUrls[id] }).eq('id', id)
    setOpps(prev => prev.map(o => o.id === id ? { ...o, reply_url: replyUrls[id] } : o))
    toast.success('Reply URL saved')
    setSaving(prev => ({ ...prev, [id]: false }))
  }

  async function checkForReply(opp: Opportunity) {
    if (!opp.reply_url) return
    // For Reddit: fetch the .json endpoint to check reply count
    if (opp.source === 'reddit') {
      try {
        const jsonUrl = opp.reply_url.replace(/\/?$/, '.json')
        const res = await fetch(`https://www.reddit.com${new URL(opp.reply_url).pathname}.json`, {
          headers: { 'User-Agent': 'IndieOS/1.0' }
        })
        if (res.ok) {
          const data = await res.json()
          const comments = data?.[1]?.data?.children ?? []
          if (comments.length > 0) {
            await supabase.from('opportunities').update({ reply_detected: true }).eq('id', opp.id)
            setOpps(prev => prev.map(o => o.id === opp.id ? { ...o, reply_detected: true } : o))
            toast.success('Reply detected!')
            return
          }
        }
      } catch {
        // silently fail — network or CORS
      }
    }
    toast.info('No reply detected yet')
  }

  if (loading) return (
    <div className="flex items-center justify-center p-16 text-zinc-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  )

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Posted opportunities</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Paste the URL of your comment to track replies.
      </p>

      <div className="mt-6 space-y-3">
        {opps.length === 0 ? (
          <p className="text-sm text-zinc-500">No posted opportunities yet.</p>
        ) : opps.map(opp => (
          <div key={opp.id} className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex flex-wrap items-start gap-2">
              <Badge variant="outline" className="text-xs capitalize">{opp.source}</Badge>
              <span className="text-sm text-zinc-600 dark:text-zinc-400">{opp.group_or_sub}</span>
              {opp.reply_detected && (
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Reply detected
                </Badge>
              )}
              <span className="ml-auto text-xs text-zinc-400">
                {opp.posted_at ? new Date(opp.posted_at).toLocaleDateString() : '—'}
              </span>
            </div>

            <p className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">{opp.post_text}</p>

            {opp.final_reply && (
              <p className="mt-1.5 rounded-md bg-zinc-50 p-2 text-xs text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 line-clamp-2">
                {opp.final_reply}
              </p>
            )}

            <div className="mt-3 flex items-center gap-2">
              <Input
                placeholder="Paste your comment URL here…"
                value={replyUrls[opp.id] ?? ''}
                onChange={e => setReplyUrls(prev => ({ ...prev, [opp.id]: e.target.value }))}
                className="flex-1 text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => saveReplyUrl(opp.id)}
                disabled={saving[opp.id] || !replyUrls[opp.id]}
              >
                {saving[opp.id] ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Save'}
              </Button>
              {opp.reply_url && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => checkForReply(opp)}>
                    <Bell className="h-3.5 w-3.5 mr-1" /> Check
                  </Button>
                  <a href={opp.reply_url} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="ghost">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </a>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
