import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { appName, appDescription, slideCount } = await request.json()

  const systemPrompt = `You are an expert app store marketing copywriter. Write punchy, benefit-led screenshot captions that convert browsers to downloaders. Headlines are bold and direct. Supporting text clarifies the benefit in one line.`

  const userPrompt = `Write ${slideCount ?? 4} screenshot slide captions for this app:
App: ${appName}
Description: ${appDescription ?? ''}

Return ONLY valid JSON with no markdown:
{
  "slides": [
    { "headline": "max 30 chars, bold benefit", "subtext": "max 60 chars, supporting detail" }
  ]
}`

  try {
    const raw = await callDeepSeek(systemPrompt, userPrompt, 600, 0.7)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate copy'
    console.error('[screenshots/generate-copy]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
