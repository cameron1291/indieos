import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app_name, description, slide_count } = await request.json()

  const systemPrompt = `You are an expert app store marketing copywriter. You write punchy, benefit-led screenshot captions that convert browsers to downloaders. Headlines are bold and direct. Supporting text clarifies the benefit.`

  const userPrompt = `Write ${slide_count ?? 5} screenshot slide captions for this app:
App: ${app_name}
Description: ${description ?? ''}

Return ONLY valid JSON:
{
  "slides": [
    {
      "headline": "max 30 chars, bold benefit statement",
      "body": "max 60 chars, supporting detail"
    }
  ]
}`

  try {
    const raw = await callDeepSeek(systemPrompt, userPrompt, 600, 0.7)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[screenshots/generate-copy]', err)
    return NextResponse.json({ error: 'Failed to generate copy' }, { status: 500 })
  }
}
