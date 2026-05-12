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
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import type { Profile, App } from '@/types/database'

const NAV_ITEMS = [
  { label: 'Apps', href: '/dashboard/apps', icon: LayoutGrid },
  { label: 'Growth Engine', href: '/dashboard/growth', icon: TrendingUp },
  { label: 'Crawler Setup', href: '/dashboard/growth/setup', icon: SlidersHorizontal, indent: true },
  { label: 'App Store Prep', href: '/dashboard/prep', icon: PackageOpen },
  { label: 'Downloads', href: '/dashboard/downloads', icon: BarChart2 },
  { label: 'Pressure Test', href: '/dashboard/pressure', icon: FlaskConical },
  { label: 'Name Checker', href: '/dashboard/names', icon: Search },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
]

const PLAN_STYLE: Record<string, string> = {
  free:   'bg-zinc-700 text-zinc-300',
  solo:   'bg-blue-900/60 text-blue-300 border border-blue-700',
  studio: 'bg-violet-900/60 text-violet-300 border border-violet-700',
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
    <aside className="flex h-full w-64 flex-col bg-zinc-950 border-r border-zinc-800">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2.5 border-b border-zinc-800 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600 shadow-lg shadow-violet-900/50">
          <Rocket className="h-4 w-4 text-white" />
        </div>
        <span className="text-base font-bold tracking-tight text-white">IndieOS</span>
        <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide', PLAN_STYLE[profile.plan] ?? PLAN_STYLE.free)}>
          {profile.plan}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4">
        <p className="mb-2 px-5 text-[10px] font-semibold uppercase tracking-widest text-zinc-600">Menu</p>
        <ul className="space-y-0.5 px-3">
          {NAV_ITEMS.map(({ label, href, icon: Icon, indent }) => {
            const active = pathname === href || (href !== '/dashboard/growth' && pathname.startsWith(`${href}/`)) || pathname === href
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all',
                    indent && 'ml-3 py-1.5 text-xs',
                    active
                      ? 'bg-violet-600 text-white shadow-md shadow-violet-900/40'
                      : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
                  )}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', indent && 'h-3.5 w-3.5', active ? 'text-white' : 'text-zinc-500')} />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Profile + sign out */}
      <div className="border-t border-zinc-800 p-3 space-y-1">
        <div className="flex items-center gap-2.5 rounded-lg px-3 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-700 text-xs font-bold text-white shrink-0">
            {(profile.full_name ?? profile.email ?? 'U')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-xs font-medium text-zinc-200">{profile.full_name ?? 'My account'}</p>
            <p className="truncate text-[10px] text-zinc-500">{profile.email ?? ''}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
