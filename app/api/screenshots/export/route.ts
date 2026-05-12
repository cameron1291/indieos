import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase-server'
import sharp from 'sharp'
import JSZip from 'jszip'
import path from 'path'
import fs from 'fs'

const SIZES = [
  { key: 'iphone-69', label: 'iPhone 6.9"', w: 1320, h: 2868, frame: 'iphone-69.png' },
  { key: 'iphone-67', label: 'iPhone 6.7"', w: 1290, h: 2796, frame: 'iphone-67.png' },
  { key: 'iphone-65', label: 'iPhone 6.5"', w: 1242, h: 2688, frame: 'iphone-65.png' },
  { key: 'iphone-61', label: 'iPhone 6.1"', w: 1170, h: 2532, frame: 'iphone-61.png' },
  { key: 'iphone-55', label: 'iPhone 5.5"', w: 1242, h: 2208, frame: 'iphone-55.png' },
  { key: 'ipad-pro-13', label: 'iPad Pro 13"', w: 2064, h: 2752, frame: 'ipad-pro-13.png' },
  { key: 'ipad-pro-11', label: 'iPad Pro 11"', w: 1668, h: 2388, frame: 'ipad-pro-11.png' },
  { key: 'gplay-feature', label: 'Google Play Feature', w: 1024, h: 500, frame: null },
  { key: 'gplay-phone', label: 'Google Play Phone', w: 1080, h: 1920, frame: 'gplay-phone.png' },
]

const TEMPLATES: Record<string, { from: string; to: string; text: string; accent: string }> = {
  dark:    { from: '#0f0f1a', to: '#1e1040', text: '#ffffff', accent: '#a78bfa' },
  light:   { from: '#ffffff', to: '#f0f0f8', text: '#111111', accent: '#7c3aed' },
  purple:  { from: '#4c1d95', to: '#7c3aed', text: '#ffffff', accent: '#e9d5ff' },
  ocean:   { from: '#0c1a3e', to: '#1e3a8a', text: '#ffffff', accent: '#60a5fa' },
  sunset:  { from: '#7c2d12', to: '#ea580c', text: '#ffffff', accent: '#fed7aa' },
  mint:    { from: '#064e3b', to: '#059669', text: '#ffffff', accent: '#a7f3d0' },
}

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function makeBgSvg(w: number, h: number, tmpl: typeof TEMPLATES[string]): Buffer {
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="60%" y2="100%">
      <stop offset="0%" stop-color="${tmpl.from}"/>
      <stop offset="100%" stop-color="${tmpl.to}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#bg)"/>
</svg>`
  return Buffer.from(svg)
}

function makeTextSvg(w: number, h: number, headline: string, body: string, tmpl: typeof TEMPLATES[string], isLandscape: boolean): Buffer {
  const titleSize = Math.round(w * (isLandscape ? 0.045 : 0.055))
  const bodySize = Math.round(titleSize * 0.55)
  const titleY = Math.round(h * (isLandscape ? 0.18 : 0.1))
  const bodyY = titleY + titleSize + Math.round(bodySize * 1.4)
  const pad = Math.round(w * 0.06)

  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
  <text x="${w / 2}" y="${titleY}" font-family="system-ui, -apple-system, sans-serif" font-size="${titleSize}" font-weight="700" fill="${tmpl.text}" text-anchor="middle" dominant-baseline="hanging">${escapeXml(headline)}</text>
  <text x="${w / 2}" y="${bodyY}" font-family="system-ui, -apple-system, sans-serif" font-size="${bodySize}" font-weight="400" fill="${tmpl.accent}" text-anchor="middle" dominant-baseline="hanging">${escapeXml(body)}</text>
</svg>`
  return Buffer.from(svg)
}

async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`)
  return Buffer.from(await res.arrayBuffer())
}

async function compositeSlide(
  rawBuf: Buffer,
  size: typeof SIZES[number],
  headline: string,
  body: string,
  tmpl: typeof TEMPLATES[string],
): Promise<Buffer> {
  const { w, h } = size
  const isLandscape = w > h

  // Screen area: lower 62% of image, centered, 86% wide
  const screenW = Math.round(w * 0.86)
  const screenH = Math.round(h * (isLandscape ? 0.55 : 0.62))
  const screenX = Math.round((w - screenW) / 2)
  const screenY = isLandscape ? Math.round(h * 0.38) : Math.round(h * 0.29)

  // Resize raw screenshot to fit screen area (cover, clip to exact dimensions)
  const resizedScreen = await sharp(rawBuf)
    .resize(screenW, screenH, { fit: 'cover', position: 'top' })
    .png()
    .toBuffer()

  const bgBuf = await sharp(makeBgSvg(w, h, tmpl)).png().toBuffer()
  const textBuf = makeTextSvg(w, h, headline, body, tmpl, isLandscape)

  const layers: sharp.OverlayOptions[] = [
    { input: resizedScreen, top: screenY, left: screenX },
    { input: textBuf, top: 0, left: 0 },
  ]

  // Composite device frame on top if it exists
  const framePath = path.join(process.cwd(), 'public', 'frames', size.frame ?? '')
  if (size.frame && fs.existsSync(framePath)) {
    const frameBuf = await sharp(fs.readFileSync(framePath))
      .resize(w, h, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer()
    layers.push({ input: frameBuf, top: 0, left: 0 })
  }

  return sharp(bgBuf).composite(layers).png().toBuffer()
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app_id, screenshots, template, slides } = await request.json()

  if (!app_id || !screenshots?.length || !template || !slides?.length) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const tmpl = TEMPLATES[template] ?? TEMPLATES.dark

  try {
    const zip = new JSZip()

    for (let slideIdx = 0; slideIdx < screenshots.length; slideIdx++) {
      const rawUrl = screenshots[slideIdx] as string
      const slide = slides[slideIdx] as { headline: string; body: string }
      if (!rawUrl || !slide) continue

      const rawBuf = await fetchImageBuffer(rawUrl)

      for (const size of SIZES) {
        const imgBuf = await compositeSlide(rawBuf, size, slide.headline ?? '', slide.body ?? '', tmpl)
        zip.file(`${size.key}/slide-${slideIdx + 1}.png`, imgBuf)
      }
    }

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })

    // Upload to Supabase Storage
    const serviceClient = createServiceClient()
    const exportPath = `screenshots/${user.id}/${app_id}/exports/screenshots-${Date.now()}.zip`
    const { error: uploadErr } = await serviceClient.storage
      .from('app-assets')
      .upload(exportPath, zipBuf, { contentType: 'application/zip', upsert: true })

    if (uploadErr) throw uploadErr

    const { data: signedData } = await serviceClient.storage
      .from('app-assets')
      .createSignedUrl(exportPath, 3600)

    // Save record to screenshot_sets
    await supabase.from('screenshot_sets').insert({
      app_id,
      user_id: user.id,
      template_id: template,
      slides,
      export_url: signedData?.signedUrl ?? null,
    })

    return NextResponse.json({ url: signedData?.signedUrl })
  } catch (err) {
    console.error('[screenshots/export]', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
