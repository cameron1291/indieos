import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, PackageOpen, BarChart2, Plus } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileResult, statsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('opportunities')
      .select('status', { count: 'exact', head: false })
      .eq('user_id', user.id)
      .eq('status', 'pending'),
  ])

  const profile = profileResult.data
  const pendingCount = statsResult.count ?? 0

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">
          Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Here&apos;s what&apos;s happening with your apps.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Opportunities</CardTitle>
            <TrendingUp className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            <Link href="/dashboard/growth" className="mt-1 text-xs text-violet-600 underline underline-offset-2">
              Review now
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">App Store Prep</CardTitle>
            <PackageOpen className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">Generate listings, screenshots, and icons.</p>
            <Link href="/dashboard/prep" className="mt-1 text-xs text-violet-600 underline underline-offset-2">
              Get started
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Downloads</CardTitle>
            <BarChart2 className="h-4 w-4 text-zinc-400" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">Connect App Store Connect to see stats.</p>
            <Link href="/dashboard/stats" className="mt-1 text-xs text-violet-600 underline underline-offset-2">
              Connect
            </Link>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Quick actions</h2>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/dashboard/apps/new">
              <Plus className="mr-2 h-4 w-4" /> Add app
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/pressure-test">Run pressure test</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/dashboard/pressure-test/names">Check app names</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
