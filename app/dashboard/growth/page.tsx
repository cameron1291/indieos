'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import {
  CheckCircle2, XCircle, Copy, ExternalLink, ChevronDown, ChevronUp,
  Loader2, RefreshCw, MessageSquare
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Opportunity, App } from '@/types/database'

type FilteredOpportunity = Opportunity & { apps?: { name: string } }

const SOURCE_ICONS: Record<string, string> = {
  reddit: '🤖',
  facebook: '📘',
  hackernews: '🟠',
  indiehackers: '🟣',
}

const SCORE_COLOUR = (score: number) =>
  score >= 9 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
  : score >= 8 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'

const TYPE_LABELS: Record<string, string> = {
  direct_request: 'Direct ask',
  pain_point: 'Pain point',
  comparison: 'Comparison',
  rejected: 'Rejected',
}

function OpportunityCard({ opp, onStatusChange }: {
  opp: FilteredOpportunity
  onStatusChange: (id: string, status: string, reply?: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [editing, setEditing] = useState(false)
  const [reply, setReply] = useState(opp.final_reply ?? opp.suggested_reply ?? '')
  const [saving, setSaving] = useState(false)

  async function handleApprove() {
    setSaving(true)
    onStatusChange(opp.id, 'approved', reply)
    setSaving(false)
  }

  async function handleReject() {
    onStatusChange(opp.id, 'rejected')
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(reply)
    toast.success('Reply copied')
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Header row */}
      <div className="flex flex-wrap items-start gap-2">
        <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', SCORE_COLOUR(opp.score ?? 0))}>
          {(opp.score ?? 0).toFixed(1)}
        </span>
        <span className="text-sm">{SOURCE_ICONS[opp.source] ?? '📌'} {opp.group_or_sub}</span>
        {opp.opportunity_type && opp.opportunity_type !== 'rejected' && (
          <Badge variant="outline" className="text-xs">{TYPE_LABELS[opp.opportunity_type] ?? opp.opportunity_type}</Badge>
        )}
        {(opp as FilteredOpportunity & { apps?: { name: string } }).apps?.name && (
          <Badge variant="secondary" className="text-xs">{(opp as FilteredOpportunity & { apps?: { name: string } }).apps!.name}</Badge>
        )}
        <span className="ml-auto text-xs text-zinc-400">
          {new Date(opp.created_at).toLocaleDateString()}
        </span>
      </div>

      {/* Post text */}
      <div className="mt-2">
        <p className={cn('text-sm text-zinc-700 dark:text-zinc-300', !expanded && 'line-clamp-3')}>
          {opp.post_text}
        </p>
        {(opp.post_text?.length ?? 0) > 200 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="mt-0.5 flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-600"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? 'Collapse' : 'Expand'}
          </button>
        )}
      </div>

      {/* View original link */}
      {opp.post_url && (
        <a
          href={opp.post_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"
        >
          View original <ExternalLink className="h-3 w-3" />
        </a>
      )}

      {/* Reply textarea */}
      <div className="mt-3">
        <Textarea
          value={reply}
          onChange={e => setReply(e.target.value)}
          rows={3}
          disabled={!editing && opp.status !== 'pending'}
          className="text-sm"
          placeholder="AI suggested reply…"
        />
      </div>

      {/* Actions */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {opp.status === 'pending' && (
          <>
            <Button size="sm" onClick={handleApprove} disabled={saving || !reply}>
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />}
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(e => !e)}>
              {editing ? 'Done editing' : 'Edit reply'}
            </Button>
            <Button size="sm" variant="ghost" onClick={handleReject}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" /> Reject
            </Button>
          </>
        )}
        {opp.status === 'approved' && (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">Approved</Badge>
        )}
        {opp.status === 'posted' && (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Posted</Badge>
        )}
        {opp.status === 'rejected' && (
          <Badge variant="secondary">Rejected</Badge>
        )}
        {reply && (
          <Button size="sm" variant="ghost" onClick={handleCopy} className="ml-auto">
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy reply
          </Button>
        )}
      </div>
    </div>
  )
}

export default function GrowthPage() {
  const searchParams = useSearchParams()
  const [opps, setOpps] = useState<FilteredOpportunity[]>([])
  const [apps, setApps] = useState<App[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [appFilter, setAppFilter] = useState(searchParams.get('app') ?? 'all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('pending')
  const [scoreFilter, setScoreFilter] = useState('8')

  const supabase = createClient()

  const loadOpps = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('opportunities')
      .select('*, apps(name)')
      .order('score', { ascending: false })

    if (appFilter !== 'all') query = query.eq('app_id', appFilter)
    if (sourceFilter !== 'all') query = query.eq('source', sourceFilter)
    if (statusFilter !== 'all') query = query.eq('status', statusFilter)
    if (scoreFilter !== 'all') query = query.gte('score', parseFloat(scoreFilter))

    const { data } = await query
    setOpps((data ?? []) as FilteredOpportunity[])
    setLoading(false)
  }, [appFilter, sourceFilter, statusFilter, scoreFilter])

  useEffect(() => {
    supabase.from('apps').select('*').then(({ data }) => setApps((data ?? []) as App[]))
  }, [])

  useEffect(() => {
    loadOpps()
  }, [loadOpps])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('opportunities-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'opportunities' }, () => {
        loadOpps()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadOpps])

  async function handleStatusChange(id: string, status: string, reply?: string) {
    const update: Record<string, unknown> = { status }
    if (reply) update.final_reply = reply
    if (status === 'posted') update.posted_at = new Date().toISOString()

    await supabase.from('opportunities').update(update).eq('id', id)

    setOpps(prev => prev.map(o =>
      o.id === id ? { ...o, status: status as Opportunity['status'], ...(reply ? { final_reply: reply } : {}) } : o
    ))

    const messages: Record<string, string> = {
      approved: 'Opportunity approved',
      rejected: 'Opportunity rejected',
      posted: 'Marked as posted',
    }
    if (messages[status]) toast.success(messages[status])
  }

  const pendingCount = opps.filter(o => o.status === 'pending').length

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Growth Engine</h1>
          {statusFilter === 'pending' && pendingCount > 0 && (
            <p className="mt-0.5 text-sm text-zinc-500">{pendingCount} pending opportunit{pendingCount === 1 ? 'y' : 'ies'}</p>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={loadOpps} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      {/* Filter bar */}
      <div className="mt-4 flex flex-wrap gap-2">
        <select
          value={appFilter}
          onChange={e => setAppFilter(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="all">All apps</option>
          {apps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <select
          value={sourceFilter}
          onChange={e => setSourceFilter(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="all">All sources</option>
          <option value="reddit">Reddit</option>
          <option value="facebook">Facebook</option>
        </select>

        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="posted">Posted</option>
          <option value="rejected">Rejected</option>
          <option value="all">All statuses</option>
        </select>

        <select
          value={scoreFilter}
          onChange={e => setScoreFilter(e.target.value)}
          className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          <option value="8">Score 8+</option>
          <option value="9">Score 9+</option>
          <option value="all">All scores</option>
        </select>
      </div>

      {/* Feed */}
      <div className="mt-4 space-y-3">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : opps.length === 0 ? (
          <div className="rounded-lg border border-dashed border-zinc-300 py-16 text-center dark:border-zinc-700">
            <MessageSquare className="mx-auto h-8 w-8 text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-sm font-medium text-zinc-500">No opportunities found</p>
            <p className="mt-1 text-xs text-zinc-400">
              {statusFilter === 'pending'
                ? 'The crawler runs every 4 hours. Check back soon.'
                : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          opps.map(opp => (
            <OpportunityCard key={opp.id} opp={opp} onStatusChange={handleStatusChange} />
          ))
        )}
      </div>
    </div>
  )
}
