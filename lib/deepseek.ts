import OpenAI from 'openai'

export const DEEPSEEK_MODEL = 'deepseek-chat'

function getDeepSeek(): OpenAI {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is not set in environment variables')
  return new OpenAI({
    apiKey,
    baseURL: 'https://api.deepseek.com',
  })
}

export async function callDeepSeek(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 1000,
  temperature = 0.7
): Promise<string> {
  async function attempt(): Promise<string> {
    const response = await getDeepSeek().chat.completions.create({
      model: DEEPSEEK_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: maxTokens,
      temperature,
    })
    return response.choices[0]?.message?.content?.trim() ?? ''
  }

  try {
    return await attempt()
  } catch {
    // Retry once on failure
    try {
      return await attempt()
    } catch (err) {
      console.error('[DeepSeek] Failed after retry:', err)
      throw err
    }
  }
}
