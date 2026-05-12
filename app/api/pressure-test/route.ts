import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

const SYSTEM_PROMPT = `You are a brutally honest startup advisor who has seen thousands of app ideas succeed and fail. You analyse ideas with rigorous market thinking. You are direct, specific, and cite real patterns from successful and failed apps. Never be vague or generic.`

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { idea, target_user, monetisation, competition } = await request.json()
  if (!idea) return NextResponse.json({ error: 'idea required' }, { status: 400 })

  const userPrompt = `Pressure-test this app idea:

IDEA: ${idea}
TARGET USER: ${target_user ?? 'not specified'}
MONETISATION PLAN: ${monetisation ?? 'not specified'}
KNOWN COMPETITION: ${competition ?? 'not specified'}

Return ONLY valid JSON with this exact structure:
{
  "verdict": "BUILD" | "DONT_BUILD" | "PIVOT",
  "verdict_reason": "one punchy sentence",
  "score": 1-10,
  "sections": {
    "market_size": {
      "rating": "large" | "medium" | "niche",
      "summary": "2-3 sentences on TAM, real numbers if you know them",
      "signals": ["evidence of demand", "search trends", "reddit activity etc"]
    },
    "competition": {
      "rating": "red_ocean" | "moderate" | "blue_ocean",
      "summary": "who are the real competitors, what do they do well/badly",
      "gap": "the specific gap this idea could fill"
    },
    "differentiation": {
      "rating": "strong" | "moderate" | "weak",
      "summary": "is there a real wedge here or is this a me-too app",
      "moat": "what could prevent copying once you get traction"
    },
    "monetisation": {
      "rating": "clear" | "uncertain" | "risky",
      "summary": "does the target user pay for this type of thing, willingness-to-pay analysis",
      "model_recommendation": "suggested pricing model with numbers"
    },
    "go_to_market": {
      "summary": "how would you actually get the first 100 users",
      "channels": ["specific channel 1", "specific channel 2", "specific channel 3"]
    },
    "risks": [
      {"risk": "specific risk", "severity": "high" | "medium" | "low", "mitigation": "how to address it"}
    ],
    "pivot_suggestions": ["alternative angle 1", "alternative angle 2"],
    "build_advice": "if BUILD/PIVOT: what to build first as MVP, what to cut"
  }
}`

  try {
    const raw = await callDeepSeek(SYSTEM_PROMPT, userPrompt, 2000, 0.4)
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const result = JSON.parse(cleaned)

    await supabase.from('pressure_tests').insert({
      user_id: user.id,
      idea_description: idea,
      result,
      verdict: result.verdict,
    })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[pressure-test]', err)
    return NextResponse.json({ error: 'Analysis failed' }, { status: 500 })
  }
}
