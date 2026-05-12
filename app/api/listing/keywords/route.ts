import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

const SYSTEM_PROMPT = `You are an ASO keyword research expert. You identify high-value, searchable keywords that balance volume, intent, and competition.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { description, target_user, platform } = await request.json()

  const userPrompt = `Generate 30 keyword suggestions for this app:
Description: ${description}
Target user: ${target_user ?? ''}
Platform: ${platform ?? 'ios'}

Return ONLY valid JSON:
{
  "keywords": [
    {
      "keyword": "invoice app tradies",
      "intent": "high|medium|low",
      "competition": "high|medium|low",
      "recommended": true,
      "why": "one sentence reason"
    }
  ]
}`

  try {
    const raw = await callDeepSeek(SYSTEM_PROMPT, userPrompt, 1000, 0.5)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[listing/keywords]', err)
    const msg = err instanceof Error ? err.message : 'Failed to generate keywords'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
