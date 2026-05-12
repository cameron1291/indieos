'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, RefreshCw, TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { App } from '@/types/database'
import { DownloadsChart } from './downloads-chart'

interface RawStat {
  app_id: string
  date: string
  downloads: number
  revenue_usd: number
  country: string
  source: string
}

interface DayStat {
  date: string
  ios: number
  android: number
  revenue: number
}

interface CountryStat {
  country: string
  downloads: number
}

const RANGES = [7, 30, 90] as const
type Range = typeof RANGES[number]

export default function DownloadsPage() {
  const [apps, setApps] = useState<App[]>([])
  const [selectedApp, setSelectedApp] = useState<string | null>(null)
  const [range, setRange] = useState<Range>(30)
  const [view, setView] = useState<'downloads' | 'revenue'>('downloads')
  const [stats, setStats] = useState<RawStat[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    createClient().from('apps').select('*').order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data?.length) {
          setApps(data as App[])
          setSelectedApp((data as App[])[0].id)
        }
      })
  }, [])

  useEffect(() => {
    if (!selectedApp) return
    setLoading(true)
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - range)
    createClient()
      .from('download_stats')
      .select('*')
      .eq('app_id', selectedApp)
      .gte('date', cutoff.toISOString().slice(0, 10))
      .order('date', { ascending: true })
      .then(({ data }) => {
        setStats((data ?? []) as RawStat[])
        setLoading(false)
      })
  }, [selectedApp, range])

  async function sync() {
    if (!selectedApp) return
    setSyncing(true)
    try {
      const res = await fetch('/api/downloads/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ app_id: selectedApp }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(`Synced ${json.synced} data points`)
      // Refresh stats
      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - range)
      const { data } = await createClient()
        .from('download_stats')
        .select('*')
        .eq('app_id', selectedApp)
        .gte('date', cutoff.toISOString().slice(0, 10))
        .order('date', { ascending: true })
      setStats((data ?? []) as RawStat[])
    } catch (err) {
      toast.error('Sync failed — check API credentials in settings')
    } finally {
      setSyncing(false)
    }
  }

  // Build day-by-day series
  const chartData: DayStat[] = (() => {
    const byDate: Record<string, DayStat> = {}
    for (const s of stats) {
      if (!byDate[s.date]) byDate[s.date] = { date: s.date, ios: 0, android: 0, revenue: 0 }
      if (s.source === 'ios') byDate[s.date].ios += s.downloads
      else byDate[s.date].android += s.downloads
      byDate[s.date].revenue += s.revenue_usd
    }
    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date))
  })()

  const totalDownloads = stats.reduce((a, s) => a + s.downloads, 0)
  const totalRevenue = stats.reduce((a, s) => a + s.revenue_usd, 0)
  const iosDownloads = stats.filter(s => s.source === 'ios').reduce((a, s) => a + s.downloads, 0)
  const androidDownloads = stats.filter(s => s.source === 'android').reduce((a, s) => a + s.downloads, 0)

  // Top countries
  const countryMap: Record<string, number> = {}
  for (const s of stats) {
    countryMap[s.country] = (countryMap[s.country] ?? 0) + s.downloads
  }
  const topCountries: CountryStat[] = Object.entries(countryMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([country, downloads]) => ({ country, downloads }))

  // 7-day vs prior 7-day trend
  const last7 = stats.filter(s => {
    const d = new Date(s.date)
    const now = new Date()
    return d >= new Date(now.getTime() - 7 * 86400000)
  }).reduce((a, s) => a + s.downloads, 0)
  const prior7 = stats.filter(s => {
    const d = new Date(s.date)
    const now = new Date()
    return d >= new Date(now.getTime() - 14 * 86400000) && d < new Date(now.getTime() - 7 * 86400000)
  }).reduce((a, s) => a + s.downloads, 0)
  const trendPct = prior7 > 0 ? Math.round(((last7 - prior7) / prior7) * 100) : null

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Downloads</h1>
        <Button size="sm" onClick={sync} disabled={syncing || !selectedApp}>
          {syncing ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-2 h-3.5 w-3.5" />}
          {syncing ? 'Syncing…' : 'Sync now'}
        </Button>
      </div>

      {/* App + range selectors */}
      <div className="flex flex-wrap gap-3">
        {apps.length > 1 && (
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
            {apps.map(a => (
              <button
                key={a.id}
                onClick={() => setSelectedApp(a.id)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm transition-colors',
                  selectedApp === a.id ? 'bg-white shadow font-medium dark:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                {a.name}
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                'rounded-md px-3 py-1 text-sm transition-colors',
                range === r ? 'bg-white shadow font-medium dark:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Total downloads',
            value: totalDownloads.toLocaleString(),
            sub: trendPct !== null ? (
              <span className={cn('flex items-center gap-1 text-xs', trendPct >= 0 ? 'text-green-600' : 'text-red-500')}>
                {trendPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {Math.abs(trendPct)}% vs prev 7d
              </span>
            ) : null,
          },
          { label: 'Revenue', value: `$${totalRevenue.toFixed(2)}` },
          { label: 'iOS downloads', value: iosDownloads.toLocaleString() },
          { label: 'Android downloads', value: androidDownloads.toLocaleString() },
        ].map(({ label, value, sub }) => (
          <Card key={label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-zinc-500">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{loading ? '—' : value}</p>
              {sub}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">
            {view === 'downloads' ? 'Downloads by platform' : 'Revenue'}
          </CardTitle>
          <div className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
            {(['downloads', 'revenue'] as const).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  'rounded-md px-3 py-1 text-sm capitalize transition-colors',
                  view === v ? 'bg-white shadow font-medium dark:bg-zinc-800' : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100'
                )}
              >
                {v}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex h-[220px] items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
            </div>
          ) : (
            <DownloadsChart data={chartData} view={view} />
          )}
        </CardContent>
      </Card>

      {/* Top countries */}
      {topCountries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Top countries ({range}d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {topCountries.map(({ country, downloads: dl }) => {
                const pct = totalDownloads > 0 ? Math.round((dl / totalDownloads) * 100) : 0
                return (
                  <div key={country} className="flex items-center gap-3">
                    <span className="w-12 text-sm font-medium">{country}</span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                      <div className="h-full rounded-full bg-violet-500" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm text-zinc-500 w-16 text-right">{dl.toLocaleString()} ({pct}%)</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No credentials notice */}
      {!loading && stats.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">No stats yet</p>
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Add your App Store Connect and Google Play credentials to .env.local, then click Sync now.
            Required: APP_STORE_CONNECT_KEY_ID, APP_STORE_CONNECT_ISSUER_ID, APP_STORE_CONNECT_PRIVATE_KEY
          </p>
        </div>
      )}
    </div>
  )
}
