'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutGrid,
  TrendingUp,
  PackageOpen,
  BarChart2,
  FlaskConical,
  Settings,
  LogOut,
  Rocket,
  ChevronDown,
  Search,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Profile, App } from '@/types/database'

const NAV_ITEMS = [
  { label: 'Apps', href: '/dashboard/apps', icon: LayoutGrid },
  { label: 'Growth Engine', href: '/dashboard/growth', icon: TrendingUp },
  { label: 'App Store Prep', href: '/dashboard/prep', icon: PackageOpen },
  { label: 'Downloads', href: '/dashboard/downloads', icon: BarChart2 },
  { label: 'Pressure Test', href: '/dashboard/pressure', icon: FlaskConical },
  { label: 'Name Checker', href: '/dashboard/names', icon: Search },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

const PLAN_COLOURS: Record<string, string> = {
  free: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
  solo: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  studio: 'bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300',
}

interface SidebarProps {
  profile: Profile
  apps: App[]
  currentAppId?: string
}

export function Sidebar({ profile, apps, currentAppId }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-4 dark:border-zinc-800">
        <Rocket className="h-5 w-5 text-violet-600" />
        <span className="text-base font-bold tracking-tight">IndieOS</span>
        <span className={cn('ml-auto rounded-full px-2 py-0.5 text-xs font-medium', PLAN_COLOURS[profile.plan])}>
          {profile.plan}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-0.5 px-2">
          {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    active
                      ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50'
                      : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Sign out */}
      <div className="border-t border-zinc-200 p-2 dark:border-zinc-800">
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
