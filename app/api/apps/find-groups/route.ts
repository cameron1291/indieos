import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

const SYSTEM_PROMPT = `You are an expert at finding Facebook groups where potential app users hang out.
Generate specific, high-quality search terms that would surface relevant groups.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app_id } = await request.json()
  if (!app_id) return NextResponse.json({ error: 'app_id required' }, { status: 400 })

  const { data: app } = await supabase.from('apps').select('*').eq('id', app_id).single()
  if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 })

  const userPrompt = `Generate 15 Facebook group search terms for finding groups where users of this app congregate.

App: ${app.name}
Description: ${app.description ?? ''}
Target user: ${app.target_user ?? ''}
Problem solved: ${app.problem_solved ?? ''}

Rules:
- Mix of profession-specific, problem-specific, and community groups
- No brand names
- Real terms someone would type into Facebook group search

Return ONLY a JSON array of objects:
[{"term": "search term", "rationale": "why this group type is relevant"}]`

  try {
    const raw = await callDeepSeek(SYSTEM_PROMPT, userPrompt, 600, 0.5)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const terms = JSON.parse(cleaned)
    return NextResponse.json({ terms })
  } catch (err) {
    console.error('[find-groups]', err)
    return NextResponse.json({ error: 'Failed to generate search terms' }, { status: 500 })
  }
}
