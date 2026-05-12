import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { callDeepSeek } from '@/lib/deepseek'

export async function GET() {
  const checks: Record<string, string> = {}

  // 1. Check env var
  checks.deepseek_key_set = process.env.DEEPSEEK_API_KEY ? 'YES' : 'NO'
  checks.key_prefix = process.env.DEEPSEEK_API_KEY?.slice(0, 6) ?? 'none'

  // 2. Check auth
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    checks.auth = user ? `OK (${user.email})` : 'NO USER — session not found'
  } catch (e) {
    checks.auth = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  // 3. Try DeepSeek
  try {
    const result = await callDeepSeek('You are a test assistant.', 'Reply with the single word: OK', 5, 0)
    checks.deepseek = `OK — response: "${result.slice(0, 50)}"`
  } catch (e) {
    checks.deepseek = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  return NextResponse.json(checks)
}
