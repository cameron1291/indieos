import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase-server'

// GET — fetch unread count + recent notifications
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, count } = await supabase
    .from('notifications')
    .select('*', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const unread = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('read', false)

  return NextResponse.json({ notifications: data ?? [], unread: unread.count ?? 0 })
}

// PATCH — mark notification(s) read
export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, all } = await request.json()

  if (all) {
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
  } else if (id) {
    await supabase.from('notifications').update({ read: true }).eq('id', id).eq('user_id', user.id)
  }

  return NextResponse.json({ ok: true })
}
