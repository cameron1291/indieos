'use client'

import { Menu } from 'lucide-react'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Sidebar } from './sidebar'
import { NotificationBell } from './notification-bell'
import type { Profile, App } from '@/types/database'

interface TopbarProps {
  profile: Profile
  apps: App[]
  currentApp?: App
}

export function Topbar({ profile, apps, currentApp }: TopbarProps) {
  return (
    <header className="flex h-14 items-center gap-3 border-b border-zinc-200 bg-white px-4 dark:border-zinc-800 dark:bg-zinc-950">
      {/* Mobile sidebar trigger */}
      <Sheet>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden" />}>
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <Sidebar profile={profile} apps={apps} />
        </SheetContent>
      </Sheet>

      {currentApp && (
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {currentApp.name}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
      </div>
    </header>
  )
}
