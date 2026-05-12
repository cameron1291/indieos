import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createServiceClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const appId = formData.get('appId') as string | null
  const index = formData.get('index') as string | null

  if (!file || !appId) return NextResponse.json({ error: 'file and appId required' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'png'
  const path = `screenshots/${user.id}/${appId}/raw/slide-${index ?? '0'}-${Date.now()}.${ext}`

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  // Use service client to bypass RLS on storage
  const service = createServiceClient()
  const { error } = await service.storage.from('app-assets').upload(path, buffer, {
    contentType: file.type,
    upsert: true,
  })

  if (error) {
    console.error('[screenshots/upload]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = service.storage.from('app-assets').getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
