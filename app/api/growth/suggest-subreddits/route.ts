import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { appName, appDescription } = await request.json()

  const system = `You are an expert at Reddit growth marketing for mobile apps. You find the exact communities where potential users discuss the problems that apps solve.`

  const prompt = `Find the best subreddits to monitor for marketing opportunities for this app:
App: ${appName}
Description: ${appDescription ?? ''}

Include:
- Subreddits where users ask for app recommendations
- Communities where users complain about the problem this app solves
- Lifestyle subreddits whose audience would benefit from this app
- Tech/productivity communities relevant to the app's domain

Return 12-18 subreddits. Return ONLY valid JSON:
{
  "subreddits": [
    { "name": "subreddit_name", "reason": "why this community is relevant (one sentence)" }
  ]
}`

  try {
    const raw = await callDeepSeek(system, prompt, 800, 0.7)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to suggest subreddits'
    console.error('[growth/suggest-subreddits]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
