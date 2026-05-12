'use client'

import { Menu, Rocket } from 'lucide-react'
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
    <header className="flex h-14 items-center gap-3 border-b border-zinc-800 bg-zinc-900 px-4">
      {/* Mobile sidebar trigger */}
      <Sheet>
        <SheetTrigger render={<Button variant="ghost" size="icon" className="lg:hidden text-zinc-400 hover:text-white hover:bg-zinc-800" />}>
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0 border-zinc-800">
          <Sidebar profile={profile} apps={apps} />
        </SheetContent>
      </Sheet>

      {/* Mobile logo */}
      <div className="flex items-center gap-2 lg:hidden">
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-600">
          <Rocket className="h-3.5 w-3.5 text-white" />
        </div>
        <span className="text-sm font-bold text-white">IndieOS</span>
      </div>

      {currentApp && (
        <span className="hidden lg:block text-sm font-medium text-zinc-400">
          {currentApp.name}
        </span>
      )}

      <div className="ml-auto flex items-center gap-1">
        <NotificationBell />
      </div>
    </header>
  )
}
