import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CrawlerStatusChart } from './crawler-chart'

export default async function CrawlerStatusPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const now = new Date()
  const day24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()
  const day7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

  const [runsResult, opps24hResult, opps7dResult, opps30dResult, appsResult, postedResult] =
    await Promise.all([
      supabase
        .from('crawler_runs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(50),
      supabase.from('opportunities').select('id', { count: 'exact', head: true }).gte('created_at', day24h),
      supabase.from('opportunities').select('id', { count: 'exact', head: true }).gte('created_at', day7),
      supabase.from('opportunities').select('id', { count: 'exact', head: true }).gte('created_at', day30),
      supabase.from('apps').select('id, name').eq('user_id', user.id),
      supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('status', 'posted').gte('posted_at', day7),
    ])

  const runs = runsResult.data ?? []

  // Last crawl per source
  const lastRuns: Record<string, typeof runs[0]> = {}
  for (const run of runs) {
    if (!lastRuns[run.source] || run.started_at > lastRuns[run.source].started_at) {
      lastRuns[run.source] = run
    }
  }

  // Top subreddits/groups by opportunities found
  const topSourcesResult = await supabase
    .from('opportunities')
    .select('group_or_sub, source')
    .gte('created_at', day30)
  const sourceCounts: Record<string, number> = {}
  for (const o of topSourcesResult.data ?? []) {
    const key = `${o.source}:${o.group_or_sub}`
    sourceCounts[key] = (sourceCounts[key] ?? 0) + 1
  }
  const topSources = Object.entries(sourceCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([key, count]) => {
      const [source, name] = key.split(':')
      return { source, name, count }
    })

  // Score distribution data
  const scoreDistResult = await supabase
    .from('opportunities')
    .select('score')
    .gte('created_at', day30)
    .not('score', 'is', null)
  const scoreBuckets: Record<string, number> = { '8.0': 0, '8.5': 0, '9.0': 0, '9.5': 0, '10': 0 }
  for (const o of scoreDistResult.data ?? []) {
    const s = o.score ?? 0
    if (s >= 10) scoreBuckets['10']++
    else if (s >= 9.5) scoreBuckets['9.5']++
    else if (s >= 9) scoreBuckets['9.0']++
    else if (s >= 8.5) scoreBuckets['8.5']++
    else if (s >= 8) scoreBuckets['8.0']++
  }

  const scoreChartData = Object.entries(scoreBuckets).map(([range, count]) => ({ range, count }))

  function timeAgo(iso: string | null | undefined) {
    if (!iso) return 'Never'
    const diff = Date.now() - new Date(iso).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor((diff % 3600000) / 60000)
    if (h > 24) return `${Math.floor(h / 24)}d ago`
    if (h > 0) return `${h}h ${m}m ago`
    return `${m}m ago`
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">Crawler status</h1>

      {/* Summary cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Opportunities (24h)', value: opps24hResult.count ?? 0 },
          { label: 'Opportunities (7d)', value: opps7dResult.count ?? 0 },
          { label: 'Opportunities (30d)', value: opps30dResult.count ?? 0 },
          { label: 'Posts made (7d)', value: postedResult.count ?? 0 },
        ].map(({ label, value }) => (
          <Card key={label}>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs font-medium text-zinc-500">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Last crawl times */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {['reddit', 'facebook'].map(source => {
          const run = lastRuns[source]
          return (
            <Card key={source}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm capitalize">{source} crawler</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Last run</span>
                  <span>{timeAgo(run?.started_at)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Posts scanned</span>
                  <span>{run?.posts_scanned ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Opportunities found</span>
                  <span>{run?.opportunities_found ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status</span>
                  {run ? (
                    <Badge variant={run.errors ? 'destructive' : 'secondary'} className="text-xs">
                      {run.errors ? 'Error' : run.completed_at ? 'Completed' : 'Running'}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">No runs yet</Badge>
                  )}
                </div>
                {run?.errors && (
                  <p className="rounded bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950 dark:text-red-300 line-clamp-2">
                    {run.errors}
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Score distribution + top sources */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Score distribution (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <CrawlerStatusChart data={scoreChartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top sources (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            {topSources.length === 0 ? (
              <p className="text-sm text-zinc-500">No data yet.</p>
            ) : (
              <div className="space-y-2">
                {topSources.map(({ source, name, count }) => (
                  <div key={`${source}:${name}`} className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400 w-16 capitalize">{source}</span>
                    <span className="flex-1 truncate text-sm">{name ?? '(unknown)'}</span>
                    <Badge variant="secondary" className="text-xs">{count}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent runs */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Recent crawler runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-zinc-500">No crawl runs recorded yet.</p>
          ) : (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {runs.slice(0, 20).map(run => (
                <div key={run.id} className="flex items-center gap-3 py-2 text-sm">
                  <Badge variant="outline" className="w-20 justify-center text-xs capitalize shrink-0">
                    {run.source}
                  </Badge>
                  <span className="flex-1 text-zinc-500">{timeAgo(run.started_at)}</span>
                  <span className="text-xs text-zinc-400">{run.posts_scanned} scanned</span>
                  <span className="text-xs font-medium text-violet-600">{run.opportunities_found} found</span>
                  {run.errors ? (
                    <Badge variant="destructive" className="text-xs">Error</Badge>
                  ) : run.completed_at ? (
                    <Badge variant="secondary" className="text-xs">Done</Badge>
                  ) : (
                    <Badge className="text-xs">Running</Badge>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
