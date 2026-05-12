import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

const SYSTEM_PROMPT = `You are an expert App Store Optimization specialist with deep knowledge of Apple App Store and Google Play algorithms. You write listings that rank well AND convert browsers to downloads. You understand keyword density, search intent, and conversion copy.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app_id, platform, name, description, features, target_user, primary_keyword } = await request.json()

  if (!platform || !name) return NextResponse.json({ error: 'platform and name required' }, { status: 400 })

  const userPrompt = `Write a complete ${platform} app listing for:
App: ${name}
Description: ${description ?? ''}
Features: ${features ?? ''}
Target user: ${target_user ?? ''}
Primary keyword: ${primary_keyword ?? ''}

Return ONLY valid JSON:
{
  "title": "max 30 chars including primary keyword",
  "subtitle": "max 30 chars, benefit-focused (iOS only)",
  "keywords": "max 100 chars, comma-separated, no spaces (iOS only)",
  "description": "max 4000 chars, keyword-rich, conversion-optimised, first 2 lines must hook without needing More tap, use line breaks for readability",
  "short_description": "max 80 chars (Android only)",
  "whats_new": "2-3 sentences for update notes",
  "aso_tips": ["3 specific improvement suggestions"]
}`

  try {
    const raw = await callDeepSeek(SYSTEM_PROMPT, userPrompt, 1200, 0.7)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)

    // Optionally save to listings table
    if (app_id) {
      await supabase.from('listings').insert({
        app_id,
        user_id: user.id,
        platform,
        title: result.title,
        subtitle: result.subtitle,
        keywords: result.keywords,
        description: result.description,
        short_description: result.short_description,
        whats_new: result.whats_new,
      })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[listing/generate]', err)
    return NextResponse.json({ error: 'Failed to generate listing' }, { status: 500 })
  }
}
