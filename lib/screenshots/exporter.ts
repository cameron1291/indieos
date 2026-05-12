import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import type { Slide, SizePreset } from './types'
import { renderToCanvas, preloadImage } from './canvas-renderer'

async function renderSlideToBlob(slide: Slide, preset: SizePreset): Promise<Blob> {
  if (slide.screenshotDataUrl) {
    await preloadImage(slide.screenshotDataUrl)
  }

  const canvas = document.createElement('canvas')
  renderToCanvas(canvas, slide, preset)

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })
}

export async function downloadSingle(
  slide: Slide,
  preset: SizePreset,
  filename = 'screenshot.png',
): Promise<void> {
  const blob = await renderSlideToBlob(slide, preset)
  saveAs(blob, filename)
}

export async function downloadZip(
  slides: Slide[],
  preset: SizePreset,
  appName = 'app',
): Promise<Blob> {
  const zip = new JSZip()
  const folder = zip.folder('screenshots')!

  for (let i = 0; i < slides.length; i++) {
    const blob = await renderSlideToBlob(slides[i], preset)
    const buf = await blob.arrayBuffer()
    const safe = appName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    folder.file(`${safe}_slide_${i + 1}_${preset.label.replace(/[^a-z0-9]/gi, '_')}.png`, buf)
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' })
  return zipBlob
}

export async function downloadZipAndSave(
  slides: Slide[],
  preset: SizePreset,
  appName = 'app',
): Promise<void> {
  const blob = await downloadZip(slides, preset, appName)
  const safe = appName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
  saveAs(blob, `${safe}_screenshots.zip`)
}
