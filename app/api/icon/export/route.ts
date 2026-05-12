import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase-server'
import sharp from 'sharp'
import JSZip from 'jszip'

const IOS_SIZES = [
  { name: 'Icon-60@2x.png', size: 120 },
  { name: 'Icon-60@3x.png', size: 180 },
  { name: 'Icon-76.png', size: 76 },
  { name: 'Icon-76@2x.png', size: 152 },
  { name: 'Icon-83.5@2x.png', size: 167 },
  { name: 'Icon-20@2x.png', size: 40 },
  { name: 'Icon-20@3x.png', size: 60 },
  { name: 'Icon-29@2x.png', size: 58 },
  { name: 'Icon-29@3x.png', size: 87 },
  { name: 'Icon-40@2x.png', size: 80 },
  { name: 'Icon-40@3x.png', size: 120 },
  { name: 'AppStore-1024.png', size: 1024 },
]

const ANDROID_SIZES = [
  { name: 'mipmap-mdpi/ic_launcher.png', size: 48 },
  { name: 'mipmap-hdpi/ic_launcher.png', size: 72 },
  { name: 'mipmap-xhdpi/ic_launcher.png', size: 96 },
  { name: 'mipmap-xxhdpi/ic_launcher.png', size: 144 },
  { name: 'mipmap-xxxhdpi/ic_launcher.png', size: 192 },
  { name: 'PlayStore-512.png', size: 512 },
]

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { app_id, image_url } = await request.json()
  if (!app_id || !image_url) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  try {
    const res = await fetch(image_url)
    if (!res.ok) throw new Error('Failed to fetch source image')
    const srcBuf = Buffer.from(await res.arrayBuffer())

    const zip = new JSZip()
    const ios = zip.folder('ios')!
    const android = zip.folder('android')!

    await Promise.all([
      ...IOS_SIZES.map(async ({ name, size }) => {
        const buf = await sharp(srcBuf).resize(size, size, { fit: 'cover' }).png().toBuffer()
        ios.file(name, buf)
      }),
      ...ANDROID_SIZES.map(async ({ name, size }) => {
        const buf = await sharp(srcBuf).resize(size, size, { fit: 'cover' }).png().toBuffer()
        android.file(name, buf)
      }),
    ])

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } })

    const serviceClient = createServiceClient()
    const exportPath = `icons/${user.id}/${app_id}/icon-export-${Date.now()}.zip`
    const { error: uploadErr } = await serviceClient.storage
      .from('app-assets')
      .upload(exportPath, zipBuf, { contentType: 'application/zip', upsert: true })

    if (uploadErr) throw uploadErr

    const { data: signedData } = await serviceClient.storage
      .from('app-assets')
      .createSignedUrl(exportPath, 3600)

    return NextResponse.json({ url: signedData?.signedUrl })
  } catch (err) {
    console.error('[icon/export]', err)
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
}
