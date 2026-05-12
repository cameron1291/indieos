'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Wand2, TrendingUp, AlertTriangle, CheckCircle2, XCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Risk { risk: string; severity: 'high' | 'medium' | 'low'; mitigation: string }
interface Section {
  rating?: string
  summary?: string
  signals?: string[]
  gap?: string
  moat?: string
  model_recommendation?: string
  channels?: string[]
  summary_text?: string
}

interface Result {
  verdict: 'BUILD' | 'DONT_BUILD' | 'PIVOT'
  verdict_reason: string
  score: number
  sections: {
    market_size: Section & { signals: string[] }
    competition: Section & { gap: string }
    differentiation: Section & { moat: string }
    monetisation: Section & { model_recommendation: string }
    go_to_market: { summary: string; channels: string[] }
    risks: Risk[]
    pivot_suggestions: string[]
    build_advice: string
  }
}

const VERDICT_CONFIG = {
  BUILD: { label: 'Build it', icon: CheckCircle2, bg: 'bg-green-50 dark:bg-green-950', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-300', badge: 'bg-green-600' },
  DONT_BUILD: { label: "Don't build", icon: XCircle, bg: 'bg-red-50 dark:bg-red-950', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-300', badge: 'bg-red-600' },
  PIVOT: { label: 'Pivot first', icon: RotateCcw, bg: 'bg-amber-50 dark:bg-amber-950', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-300', badge: 'bg-amber-500' },
}

const RATING_COLOURS: Record<string, string> = {
  large: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  niche: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
  blue_ocean: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  moderate: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  red_ocean: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  strong: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  weak: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  clear: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  uncertain: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  risky: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const SEVERITY_COLOURS: Record<string, string> = {
  high: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300',
  low: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

function SectionCard({ title, rating, summary, children }: { title: string; rating?: string; summary?: string; children?: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          {rating && (
            <Badge className={cn('text-xs capitalize', RATING_COLOURS[rating] ?? 'bg-zinc-100 text-zinc-600')}>
              {rating.replace('_', ' ')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {summary && <p className="text-sm text-zinc-600 dark:text-zinc-400">{summary}</p>}
        {children}
      </CardContent>
    </Card>
  )
}

export default function PressurePage() {
  const [idea, setIdea] = useState('')
  const [targetUser, setTargetUser] = useState('')
  const [monetisation, setMonetisation] = useState('')
  const [competition, setCompetition] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)

  async function analyse() {
    if (!idea.trim()) { toast.error('Describe your idea first'); return }
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch('/api/pressure-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea, target_user: targetUser, monetisation, competition }),
      })
      if (!res.ok) throw new Error()
      setResult(await res.json())
    } catch {
      toast.error('Analysis failed')
    } finally {
      setLoading(false)
    }
  }

  const vc = result ? VERDICT_CONFIG[result.verdict] : null

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Idea pressure tester</h1>
        <p className="mt-1 text-sm text-zinc-500">Brutally honest market analysis before you build.</p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <Label htmlFor="idea">Describe your app idea</Label>
            <Textarea
              id="idea"
              rows={4}
              placeholder="e.g. An invoice app for Australian tradies that generates invoices from voice memos and integrates with Xero..."
              value={idea}
              onChange={e => setIdea(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>Target user</Label>
              <Input placeholder="e.g. solo tradies" value={targetUser} onChange={e => setTargetUser(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Monetisation plan</Label>
              <Input placeholder="e.g. $9/mo subscription" value={monetisation} onChange={e => setMonetisation(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Known competition</Label>
              <Input placeholder="e.g. Invoice2go, Xero" value={competition} onChange={e => setCompetition(e.target.value)} />
            </div>
          </div>
          <Button onClick={analyse} disabled={loading} className="w-full">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
            {loading ? 'Analysing…' : 'Pressure test this idea'}
          </Button>
        </CardContent>
      </Card>

      {result && vc && (
        <div className="space-y-4">
          {/* Verdict banner */}
          <div className={cn('rounded-xl border p-5', vc.bg, vc.border)}>
            <div className="flex items-center gap-3">
              <vc.icon className={cn('h-8 w-8', vc.text)} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={cn('text-xl font-bold', vc.text)}>{vc.label}</span>
                  <Badge className={cn('text-white', vc.badge)}>Score: {result.score}/10</Badge>
                </div>
                <p className={cn('mt-0.5 text-sm', vc.text)}>{result.verdict_reason}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SectionCard
              title="Market size"
              rating={result.sections.market_size.rating}
              summary={result.sections.market_size.summary}
            >
              {result.sections.market_size.signals?.length > 0 && (
                <ul className="space-y-1">
                  {result.sections.market_size.signals.map((s, i) => (
                    <li key={i} className="flex gap-1.5 text-xs text-zinc-500">
                      <TrendingUp className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-500" /> {s}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>

            <SectionCard
              title="Competition"
              rating={result.sections.competition.rating}
              summary={result.sections.competition.summary}
            >
              {result.sections.competition.gap && (
                <p className="text-xs text-violet-600 dark:text-violet-400 font-medium">Gap: {result.sections.competition.gap}</p>
              )}
            </SectionCard>

            <SectionCard
              title="Differentiation"
              rating={result.sections.differentiation.rating}
              summary={result.sections.differentiation.summary}
            >
              {result.sections.differentiation.moat && (
                <p className="text-xs text-zinc-500">Moat: {result.sections.differentiation.moat}</p>
              )}
            </SectionCard>

            <SectionCard
              title="Monetisation"
              rating={result.sections.monetisation.rating}
              summary={result.sections.monetisation.summary}
            >
              {result.sections.monetisation.model_recommendation && (
                <p className="text-xs font-medium text-violet-600 dark:text-violet-400">{result.sections.monetisation.model_recommendation}</p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Go-to-market" summary={result.sections.go_to_market.summary}>
            {result.sections.go_to_market.channels?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.sections.go_to_market.channels.map((c, i) => (
                  <span key={i} className="rounded-full bg-violet-100 px-3 py-1 text-xs text-violet-700 dark:bg-violet-900 dark:text-violet-300">{c}</span>
                ))}
              </div>
            )}
          </SectionCard>

          {result.sections.risks?.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Risks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {result.sections.risks.map((r, i) => (
                  <div key={i} className="flex gap-3">
                    <AlertTriangle className={cn('h-4 w-4 shrink-0 mt-0.5', r.severity === 'high' ? 'text-red-500' : r.severity === 'medium' ? 'text-yellow-500' : 'text-zinc-400')} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{r.risk}</span>
                        <Badge className={cn('text-xs', SEVERITY_COLOURS[r.severity])}>{r.severity}</Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">{r.mitigation}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {result.sections.build_advice && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{result.verdict === 'DONT_BUILD' ? 'Why not' : 'Build advice'}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{result.sections.build_advice}</p>
                {result.sections.pivot_suggestions?.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs font-semibold text-zinc-500">Pivot ideas:</p>
                    {result.sections.pivot_suggestions.map((s, i) => (
                      <p key={i} className="text-xs text-zinc-500">→ {s}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Button variant="outline" className="w-full" onClick={() => setResult(null)}>
            Test another idea
          </Button>
        </div>
      )}
    </div>
  )
}
