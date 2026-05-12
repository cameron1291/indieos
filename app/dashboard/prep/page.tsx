import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PackageOpen, FileText, Image, Palette, Scale, CheckSquare } from 'lucide-react'
import type { App } from '@/types/database'

const TOOLS = [
  { label: 'Listing writer', icon: FileText,    slug: 'listing',    desc: 'AI-generated App Store & Play Store listing', color: 'from-violet-600 to-violet-800' },
  { label: 'Screenshots',    icon: Image,        slug: 'screenshots', desc: 'Composite screenshots for all device sizes',  color: 'from-blue-600 to-blue-800' },
  { label: 'App icon',       icon: Palette,      slug: 'icon',       desc: 'Generate icon concepts with AI',              color: 'from-pink-600 to-pink-800' },
  { label: 'Legal docs',     icon: Scale,        slug: 'legal',      desc: 'Privacy policy, terms, EULA',                 color: 'from-emerald-600 to-emerald-800' },
  { label: 'Checklist',      icon: CheckSquare,  slug: 'checklist',  desc: 'iOS & Android launch checklist',              color: 'from-orange-600 to-orange-800' },
]

export default async function PrepPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: apps } = await supabase.from('apps').select('*').eq('user_id', user.id).order('created_at')

  if (!apps?.length) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <PackageOpen className="h-10 w-10 text-zinc-600 mb-4" />
        <p className="text-zinc-400">No apps yet. <Link href="/dashboard/apps/new" className="text-violet-400 hover:underline">Create one first.</Link></p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/60 to-zinc-900 p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-600 shadow-lg shadow-violet-900/50">
            <PackageOpen className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">App Store Prep</h1>
        </div>
        <p className="text-zinc-400 max-w-lg">
          Everything you need to publish — AI-written listings, screenshots, icon, legal docs, and your launch checklist. Pick a tool to get started.
        </p>
      </div>

      {/* Tools per app */}
      {(apps as App[]).map(app => (
        <div key={app.id}>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-4 px-1">{app.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {TOOLS.map(({ label, icon: Icon, slug, desc, color }) => (
              <Link key={slug} href={`/dashboard/prep/${slug}/${app.id}`}>
                <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition-all hover:border-zinc-600 hover:bg-zinc-800">
                  <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${color} shadow-lg`}>
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="font-semibold text-zinc-100 text-sm">{label}</p>
                  <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">{desc}</p>
                  <div className="mt-4 text-xs font-medium text-violet-400 group-hover:text-violet-300 transition-colors">
                    Open →
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
