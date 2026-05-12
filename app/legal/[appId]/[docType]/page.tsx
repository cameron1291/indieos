import { createServiceClient } from '@/lib/supabase-server'
import { notFound } from 'next/navigation'

const LABELS: Record<string, string> = {
  privacy: 'Privacy Policy',
  terms: 'Terms of Service',
  eula: 'End User License Agreement',
}

interface Props {
  params: Promise<{ appId: string; docType: string }>
}

export default async function PublicLegalPage({ params }: Props) {
  const { appId, docType } = await params

  const supabase = createServiceClient()
  const { data: doc } = await supabase
    .from('legal_docs')
    .select('content, created_at')
    .eq('app_id', appId)
    .eq('doc_type', docType)
    .single()

  if (!doc) notFound()

  const { data: app } = await supabase
    .from('apps')
    .select('name')
    .eq('id', appId)
    .single()

  const label = LABELS[docType] ?? docType

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-8 border-b border-zinc-200 pb-6 dark:border-zinc-800">
        {app && <p className="text-sm text-zinc-500">{app.name}</p>}
        <h1 className="mt-1 text-3xl font-bold">{label}</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Last updated: {new Date(doc.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>
      <div className="prose prose-zinc dark:prose-invert max-w-none">
        {doc.content.split('\n').map((line: string, i: number) => {
          if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-8 mb-4">{line.slice(2)}</h1>
          if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold mt-6 mb-3">{line.slice(3)}</h2>
          if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold mt-4 mb-2">{line.slice(4)}</h3>
          if (line.startsWith('**') && line.endsWith('**')) return <p key={i} className="font-semibold mt-4">{line.slice(2, -2)}</p>
          if (line.startsWith('- ')) return <li key={i} className="ml-4 list-disc text-zinc-700 dark:text-zinc-300">{line.slice(2)}</li>
          if (line.trim() === '') return <div key={i} className="mt-3" />
          return <p key={i} className="text-zinc-700 dark:text-zinc-300 leading-relaxed">{line}</p>
        })}
      </div>
    </div>
  )
}
