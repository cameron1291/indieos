import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

const SYSTEM_PROMPT = `You are an expert at configuring community monitoring for mobile apps. Generate precise, strict configuration that will find only the most relevant conversations.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, description, target_user, problem_solved, platform } = await request.json()

  if (!name || !description) {
    return NextResponse.json({ error: 'name and description are required' }, { status: 400 })
  }

  const userPrompt = `Generate monitoring config for:
App: ${name}
Description: ${description}
Target user: ${target_user ?? 'not specified'}
Problem solved: ${problem_solved ?? 'not specified'}
Platform: ${platform ?? 'both'}

Return ONLY valid JSON:
{
  "keywords": ["3-5 word phrases only, very specific"],
  "high_intent_phrases": ["phrases showing active need, 5-10 items"],
  "penalty_keywords": ["job ads, spam signals, 10-15 items"],
  "boost_keywords": ["signals of high buying intent, 5-8 items"],
  "reddit_subreddits": ["subreddit names without r/, 8-12 subs"],
  "suggested_facebook_search_terms": ["10 terms to find relevant groups"],
  "tone": "casual and helpful"
}

HIGH_INTENT_PHRASES must be specific enough that only someone actively seeking a solution would use them. Reject generic words.`

  try {
    const raw = await callDeepSeek(SYSTEM_PROMPT, userPrompt, 800, 0.5)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const config = JSON.parse(cleaned)
    return NextResponse.json(config)
  } catch (err) {
    console.error('[generate-config] Error:', err)
    return NextResponse.json({ error: 'Failed to generate config' }, { status: 500 })
  }
}
