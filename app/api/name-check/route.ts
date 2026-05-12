import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'

interface DomainResult {
  tld: string
  available: boolean | null
  error?: string
}

interface NameResult {
  name: string
  domains: DomainResult[]
  app_store_url: string
  play_store_url: string
}

const TLDS = ['.com', '.app', '.io', '.co']

async function checkDomain(name: string, tld: string): Promise<DomainResult> {
  const domain = `${name.toLowerCase().replace(/\s+/g, '')}${tld}`

  // Use WHOIS lookup via a public API (rdap)
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    })
    if (res.status === 200) return { tld, available: false }
    if (res.status === 404) return { tld, available: true }
    return { tld, available: null }
  } catch {
    // Fallback: try Namecheap API if configured
    if (process.env.NAMECHEAP_API_KEY && process.env.NAMECHEAP_USERNAME) {
      try {
        const url = new URL('https://api.namecheap.com/xml.response')
        url.searchParams.set('ApiUser', process.env.NAMECHEAP_USERNAME)
        url.searchParams.set('ApiKey', process.env.NAMECHEAP_API_KEY)
        url.searchParams.set('UserName', process.env.NAMECHEAP_USERNAME)
        url.searchParams.set('Command', 'namecheap.domains.check')
        url.searchParams.set('ClientIp', '127.0.0.1')
        url.searchParams.set('DomainList', domain)

        const ncRes = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
        const text = await ncRes.text()
        const available = text.includes('Available="true"')
        return { tld, available }
      } catch {
        return { tld, available: null, error: 'lookup failed' }
      }
    }
    return { tld, available: null, error: 'lookup failed' }
  }
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { names, app_id } = await request.json()
  if (!names?.length) return NextResponse.json({ error: 'names array required' }, { status: 400 })

  const results: NameResult[] = await Promise.all(
    (names as string[]).slice(0, 10).map(async (name: string) => {
      const slug = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      const appStoreUrl = `https://apps.apple.com/search?term=${encodeURIComponent(name)}`
      const playStoreUrl = `https://play.google.com/store/search?q=${encodeURIComponent(name)}&c=apps`

      const domains = await Promise.all(TLDS.map(tld => checkDomain(slug, tld)))

      return { name, domains, app_store_url: appStoreUrl, play_store_url: playStoreUrl }
    })
  )

  // Save to DB
  await supabase.from('name_checks').insert({
    user_id: user.id,
    app_id: app_id ?? null,
    names_checked: results,
  })

  return NextResponse.json({ results })
}
