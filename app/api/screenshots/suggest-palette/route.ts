import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { appName, appDescription } = await request.json()

  const system = `You are a UI/brand designer who picks perfect App Store screenshot color palettes based on app context. You return hex color pairs that feel premium and on-brand.`

  const prompt = `Suggest the best screenshot background palette for this app:
App: ${appName}
Description: ${appDescription ?? ''}

Return ONLY valid JSON:
{
  "name": "palette name (e.g. Midnight Violet)",
  "type": "gradient",
  "colors": ["#hex1", "#hex2"],
  "angle": 145
}

type must be one of: "solid", "gradient", "split"
For solid, only provide one color in the array.`

  try {
    const raw = await callDeepSeek(system, prompt, 200, 0.8)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to suggest palette'
    console.error('[screenshots/suggest-palette]', err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
