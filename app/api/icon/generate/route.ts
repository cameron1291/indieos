import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import Replicate from 'replicate'

function getReplicate() {
  return new Replicate({ auth: process.env.REPLICATE_API_TOKEN! })
}

const STYLES = ['flat minimal', 'gradient glass', '3D rendered', 'bold illustrated']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app_id, app_name, description, color_hint } = await request.json()
  if (!app_name) return NextResponse.json({ error: 'app_name required' }, { status: 400 })

  const replicate = getReplicate()

  const results = await Promise.allSettled(
    STYLES.map(async (style, i) => {
      const prompt = `App icon for "${app_name}", ${description ? description + ', ' : ''}${style} style, ${color_hint ?? 'vibrant colors'}, app store icon, centered composition, no text, no letters, rounded corners, white background, 1024x1024`

      const output = await replicate.run(
        'black-forest-labs/flux-schnell' as `${string}/${string}`,
        {
          input: {
            prompt,
            num_outputs: 1,
            aspect_ratio: '1:1',
            output_format: 'png',
            output_quality: 95,
          },
        },
      )

      const urls = Array.isArray(output) ? output : [output]
      const url = typeof urls[0] === 'string' ? urls[0] : (urls[0] as { url: () => string }).url?.()
      return { style, url: String(url), index: i }
    }),
  )

  const concepts = results
    .filter((r): r is PromiseFulfilledResult<{ style: string; url: string; index: number }> => r.status === 'fulfilled')
    .map(r => r.value)

  if (concepts.length === 0) {
    return NextResponse.json({ error: 'All generations failed' }, { status: 500 })
  }

  return NextResponse.json({ concepts })
}
