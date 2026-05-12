import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import { Sidebar } from '@/components/dashboard/sidebar'
import { Topbar } from '@/components/dashboard/topbar'
import { Toaster } from 'sonner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const [profileResult, appsResult] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('apps').select('*').eq('user_id', user.id).order('created_at'),
  ])

  const profile = profileResult.data
  const apps = appsResult.data ?? []

  if (!profile) redirect('/login')
  if (!profile.onboarding_completed) redirect('/onboarding')

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-900">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:shrink-0">
        <Sidebar profile={profile} apps={apps} />
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar profile={profile} apps={apps} />
        <main className="flex-1 overflow-y-auto bg-zinc-900 text-zinc-100">
          {children}
        </main>
      </div>

      <Toaster richColors position="bottom-right" />
    </div>
  )
}
