import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase-server'
import crypto from 'crypto'

// ── App Store Connect JWT ─────────────────────────────────────────────────────

function makeAppStoreJWT(): string {
  const keyId = process.env.APP_STORE_CONNECT_KEY_ID!
  const issuerId = process.env.APP_STORE_CONNECT_ISSUER_ID!
  const privateKey = process.env.APP_STORE_CONNECT_PRIVATE_KEY!.replace(/\\n/g, '\n')

  const header = Buffer.from(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' })).toString('base64url')
  const now = Math.floor(Date.now() / 1000)
  const payload = Buffer.from(JSON.stringify({
    iss: issuerId,
    iat: now,
    exp: now + 1200,
    aud: 'appstoreconnect-v1',
  })).toString('base64url')

  const sign = crypto.createSign('SHA256')
  sign.update(`${header}.${payload}`)
  const sig = sign.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')

  return `${header}.${payload}.${sig}`
}

async function fetchAppStoreDownloads(appId: string, days: number = 30) {
  const jwt = makeAppStoreJWT()
  const rows: { date: string; downloads: number; revenue_usd: number; country: string }[] = []

  // Fetch daily sales report for each of last N days
  const end = new Date()
  const promises = Array.from({ length: days }, (_, i) => {
    const d = new Date(end)
    d.setDate(d.getDate() - i - 1)
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '')

    return fetch(
      `https://api.appstoreconnect.apple.com/v1/salesReports?filter[frequency]=DAILY&filter[reportDate]=${dateStr}&filter[reportType]=SALES&filter[vendorNumber]=${process.env.APP_STORE_VENDOR_NUMBER ?? ''}`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    ).then(async res => {
      if (!res.ok) return
      // Response is gzip-compressed TSV
      const text = await res.text()
      for (const line of text.split('\n').slice(1)) {
        const cols = line.split('\t')
        if (cols.length < 20) continue
        // Cols: Provider, ProviderCountry, SKU, Developer, Title, Version, ProductTypeIdentifier, Units, DeveloperProceeds, BeginDate, EndDate, CustomerCurrency, CountryCode, ...
        const units = parseInt(cols[7] ?? '0', 10) || 0
        const proceeds = parseFloat(cols[8] ?? '0') || 0
        const country = cols[12] ?? 'US'
        const dateRaw = cols[9] ?? ''
        // BeginDate format: MM/DD/YYYY
        const [m, day, y] = dateRaw.split('/')
        if (!y) return
        const iso = `${y}-${m?.padStart(2, '0')}-${day?.padStart(2, '0')}`
        rows.push({ date: iso, downloads: units, revenue_usd: proceeds, country })
      }
    }).catch(() => {})
  })

  await Promise.all(promises)
  return rows
}

// ── Google Play ───────────────────────────────────────────────────────────────

async function fetchPlayDownloads(packageName: string) {
  const saJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
  if (!saJson) return []

  const sa = JSON.parse(saJson)

  // Get access token via service account JWT
  const now = Math.floor(Date.now() / 1000)
  const jwtHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url')
  const jwtPayload = Buffer.from(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  })).toString('base64url')

  const sign = crypto.createSign('RSA-SHA256')
  sign.update(`${jwtHeader}.${jwtPayload}`)
  const sig = sign.sign(sa.private_key, 'base64url')
  const assertion = `${jwtHeader}.${jwtPayload}.${sig}`

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  if (!tokenRes.ok) return []
  const { access_token } = await tokenRes.json()

  // Stats API
  const statsRes = await fetch(
    `https://playdeveloperreporting.googleapis.com/v1beta1/apps/${encodeURIComponent(packageName)}/storePerformanceClusterSnapshot`,
    { headers: { Authorization: `Bearer ${access_token}` } }
  )

  if (!statsRes.ok) return []
  const statsData = await statsRes.json()

  // Parse into our format — Google Play reporting API returns different shapes
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: { date: string; downloads: number; revenue_usd: number; country: string }[] = []
  for (const row of statsData?.rows ?? []) {
    const date = row?.startTime?.slice(0, 10) ?? new Date().toISOString().slice(0, 10)
    rows.push({ date, downloads: row?.metrics?.newUserCount ?? 0, revenue_usd: 0, country: 'GLOBAL' })
  }
  return rows
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app_id } = await request.json()
  if (!app_id) return NextResponse.json({ error: 'app_id required' }, { status: 400 })

  const { data: app } = await supabase.from('apps').select('*').eq('id', app_id).eq('user_id', user.id).single()
  if (!app) return NextResponse.json({ error: 'App not found' }, { status: 404 })

  const serviceClient = createServiceClient()
  let synced = 0

  try {
    // iOS sync
    if (process.env.APP_STORE_CONNECT_KEY_ID) {
      const iosRows = await fetchAppStoreDownloads(app_id)
      for (const row of iosRows) {
        await serviceClient.from('download_stats').upsert({
          app_id,
          date: row.date,
          downloads: row.downloads,
          revenue_usd: row.revenue_usd,
          country: row.country,
          source: 'ios',
        }, { onConflict: 'app_id,date,country,source' })
        synced++
      }
    }

    // Android sync
    if (process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON && app.bundle_id) {
      const androidRows = await fetchPlayDownloads(app.bundle_id)
      for (const row of androidRows) {
        await serviceClient.from('download_stats').upsert({
          app_id,
          date: row.date,
          downloads: row.downloads,
          revenue_usd: row.revenue_usd,
          country: row.country,
          source: 'android',
        }, { onConflict: 'app_id,date,country,source' })
        synced++
      }
    }

    return NextResponse.json({ synced })
  } catch (err) {
    console.error('[downloads/sync]', err)
    return NextResponse.json({ error: 'Sync failed', synced }, { status: 500 })
  }
}
