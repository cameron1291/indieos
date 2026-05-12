import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Settings, ToggleLeft, ToggleRight } from 'lucide-react'

export default async function AppsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: apps } = await supabase
    .from('apps')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at')

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Your apps</h1>
        <Button asChild>
          <Link href="/dashboard/apps/new">
            <Plus className="mr-2 h-4 w-4" /> Add app
          </Link>
        </Button>
      </div>

      {apps && apps.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {apps.map(app => (
            <Card key={app.id}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{app.name}</CardTitle>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={app.monitoring_active ? 'default' : 'secondary'} className="text-xs">
                      {app.monitoring_active ? 'Active' : 'Paused'}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {app.platform === 'both' ? 'iOS + Android' : app.platform}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {app.description && (
                  <p className="text-sm text-zinc-500 line-clamp-2">{app.description}</p>
                )}
                <div className="flex flex-wrap gap-3 text-xs text-zinc-400">
                  <span>{app.reddit_subreddits?.length ?? 0} subreddits</span>
                  <span>{app.facebook_groups?.length ?? 0} FB groups</span>
                  <span>min score {app.min_score}</span>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button asChild size="sm" variant="outline" className="flex-1">
                    <Link href={`/dashboard/growth?app=${app.id}`}>Opportunities</Link>
                  </Button>
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/dashboard/apps/${app.id}/settings`}>
                      <Settings className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mt-16 text-center">
          <p className="text-zinc-500">No apps yet.</p>
          <Button asChild className="mt-4">
            <Link href="/dashboard/apps/new">
              <Plus className="mr-2 h-4 w-4" /> Add your first app
            </Link>
          </Button>
        </div>
      )}
    </div>
  )
}
