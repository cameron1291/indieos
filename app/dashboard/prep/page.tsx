import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PackageOpen, FileText, Image, Palette, Scale, CheckSquare } from 'lucide-react'
import type { App } from '@/types/database'

const TOOLS = [
  { label: 'Listing writer', icon: FileText, slug: 'listing', desc: 'AI-generated App Store & Play Store listing' },
  { label: 'Screenshots', icon: Image, slug: 'screenshots', desc: 'Composite screenshots for all device sizes' },
  { label: 'App icon', icon: Palette, slug: 'icon', desc: 'Generate icon concepts with AI' },
  { label: 'Legal docs', icon: Scale, slug: 'legal', desc: 'Privacy policy, terms, EULA' },
  { label: 'Submission checklist', icon: CheckSquare, slug: 'checklist', desc: 'iOS & Android launch checklist' },
]

export default async function PrepPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: apps } = await supabase.from('apps').select('*').eq('user_id', user.id).order('created_at')

  if (!apps?.length) {
    return (
      <div className="flex flex-col items-center justify-center p-16 text-center">
        <PackageOpen className="h-10 w-10 text-zinc-300 mb-4" />
        <p className="text-zinc-500">No apps yet. <Link href="/dashboard/apps/new" className="text-violet-600 hover:underline">Create one first.</Link></p>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">App Store Prep</h1>
        <p className="mt-1 text-sm text-zinc-500">Select a tool for one of your apps.</p>
      </div>

      {(apps as App[]).map(app => (
        <div key={app.id}>
          <h2 className="text-sm font-semibold text-zinc-500 mb-3">{app.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map(({ label, icon: Icon, slug, desc }) => (
              <Link key={slug} href={`/dashboard/prep/${slug}/${app.id}`}>
                <Card className="hover:border-violet-400 transition-colors cursor-pointer">
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-violet-600" />
                      <CardTitle className="text-sm">{label}</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-zinc-500">{desc}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
