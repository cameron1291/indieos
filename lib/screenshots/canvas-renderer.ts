import type { Slide, SizePreset, Background, ScreenshotEffect, Hotspot } from './types'

export function renderToCanvas(
  canvas: HTMLCanvasElement,
  slide: Slide,
  preset: SizePreset,
): void {
  canvas.width = preset.width
  canvas.height = preset.height
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, preset.width, preset.height)

  drawBackground(ctx, slide.background, preset.width, preset.height)
  drawDecorativeGlows(ctx, slide.background, preset.width, preset.height)

  // Layout: for watch feature graphic the layout is different
  const isFeatureGraphic = preset.platform === 'google' && preset.height < preset.width
  if (isFeatureGraphic) {
    drawFeatureGraphicLayout(ctx, slide, preset)
    return
  }

  const phoneLayout = computePhoneLayout(preset, slide.textPosition)

  // Draw text first if position is bottom (so phone draws over nothing)
  if (slide.textPosition === 'top') {
    drawTextBlock(ctx, slide, preset, phoneLayout.textArea)
    drawPhone(ctx, slide, preset, phoneLayout)
  } else if (slide.textPosition === 'bottom') {
    drawPhone(ctx, slide, preset, phoneLayout)
    drawTextBlock(ctx, slide, preset, phoneLayout.textArea)
  } else {
    // middle — phone centered, text overlaid at bottom of canvas
    drawPhone(ctx, slide, preset, phoneLayout)
    drawTextBlock(ctx, slide, preset, phoneLayout.textArea)
  }

  drawWatermark(ctx, preset.width, preset.height, slide.textColor)
}

// ─── Background ───────────────────────────────────────────────────────────────

function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: Background,
  w: number,
  h: number,
): void {
  if (bg.type === 'solid') {
    ctx.fillStyle = bg.colors[0] ?? '#0f0f1a'
    ctx.fillRect(0, 0, w, h)
    return
  }

  if (bg.type === 'gradient') {
    const rad = (bg.angle * Math.PI) / 180
    const cx = w / 2
    const cy = h / 2
    const len = Math.sqrt(w * w + h * h) / 2
    const grad = ctx.createLinearGradient(
      cx - Math.cos(rad) * len, cy - Math.sin(rad) * len,
      cx + Math.cos(rad) * len, cy + Math.sin(rad) * len,
    )
    grad.addColorStop(0, bg.colors[0] ?? '#3b0764')
    grad.addColorStop(1, bg.colors[1] ?? '#7c3aed')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)
    return
  }

  if (bg.type === 'split') {
    const c1 = bg.colors[0] ?? '#3b0764'
    const c2 = bg.colors[1] ?? '#7c3aed'
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, w, h / 2)
    ctx.fillStyle = c2
    ctx.fillRect(0, h / 2, w, h / 2)
  }
}

// ─── Glow decorations ─────────────────────────────────────────────────────────

function drawDecorativeGlows(
  ctx: CanvasRenderingContext2D,
  bg: Background,
  w: number,
  h: number,
): void {
  const color = bg.colors[bg.colors.length - 1] ?? '#7c3aed'
  ctx.save()
  ctx.globalAlpha = 0.18

  const g1 = ctx.createRadialGradient(w * 0.15, h * 0.25, 0, w * 0.15, h * 0.25, w * 0.45)
  g1.addColorStop(0, color)
  g1.addColorStop(1, 'transparent')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, w, h)

  const g2 = ctx.createRadialGradient(w * 0.85, h * 0.75, 0, w * 0.85, h * 0.75, w * 0.4)
  g2.addColorStop(0, color)
  g2.addColorStop(1, 'transparent')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, w, h)

  ctx.restore()
}

// ─── Layout computation ───────────────────────────────────────────────────────

interface PhoneLayout {
  phoneX: number
  phoneY: number
  phoneW: number
  phoneH: number
  screenX: number
  screenY: number
  screenW: number
  screenH: number
  textArea: { x: number; y: number; w: number; h: number }
}

function computePhoneLayout(preset: SizePreset, textPosition: Slide['textPosition']): PhoneLayout {
  const { width: canvasW, height: canvasH, platform } = preset

  const isLandscape = canvasW > canvasH
  const isWatch = platform === 'watch'

  // Phone dimensions as fraction of canvas
  let phoneWFrac = isWatch ? 0.5 : 0.72
  if (isLandscape) phoneWFrac = 0.38

  const phoneW = Math.round(canvasW * phoneWFrac)

  // Aspect ratio of the phone body (not the canvas)
  let phoneAspect: number
  if (isWatch) {
    phoneAspect = 1.22  // watch is near-square
  } else if (isLandscape) {
    phoneAspect = 2.16  // still portrait phone in landscape canvas
  } else {
    phoneAspect = platform === 'google' ? 2.1 : 2.16
  }

  const phoneH = Math.round(phoneW * phoneAspect)

  // Text area height as fraction of canvas
  const textH = Math.round(canvasH * 0.2)
  const padding = Math.round(canvasH * 0.04)

  let phoneX = Math.round((canvasW - phoneW) / 2)
  let phoneY: number
  let textArea: { x: number; y: number; w: number; h: number }

  if (textPosition === 'top') {
    phoneY = textH + padding
    textArea = { x: padding, y: padding, w: canvasW - padding * 2, h: textH - padding }
  } else if (textPosition === 'bottom') {
    phoneY = padding
    const textY = phoneY + phoneH + padding
    textArea = { x: padding, y: textY, w: canvasW - padding * 2, h: canvasH - textY - padding }
  } else {
    // middle: center the phone, text at bottom quarter
    phoneY = Math.round((canvasH - phoneH) / 2)
    const textY = phoneY + phoneH + padding
    textArea = { x: padding, y: textY, w: canvasW - padding * 2, h: canvasH - textY - padding }
  }

  // Screen inset within phone frame
  const frameTop = isWatch ? phoneH * 0.06 : phoneH * 0.04
  const frameBottom = isWatch ? phoneH * 0.06 : phoneH * 0.03
  const frameSide = phoneW * 0.04

  const screenX = phoneX + frameSide
  const screenY = phoneY + frameTop
  const screenW = phoneW - frameSide * 2
  const screenH = phoneH - frameTop - frameBottom

  return { phoneX, phoneY, phoneW, phoneH, screenX, screenY, screenW, screenH, textArea }
}

// ─── Phone frame ──────────────────────────────────────────────────────────────

function drawPhone(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  preset: SizePreset,
  layout: PhoneLayout,
): void {
  const { phoneX, phoneY, phoneW, phoneH, screenX, screenY, screenW, screenH } = layout

  // Apply effect transforms before drawing
  ctx.save()

  applyEffect(ctx, slide.screenshotEffect, phoneX, phoneY, phoneW, phoneH)

  drawPhoneFrame(ctx, preset.platform, phoneX, phoneY, phoneW, phoneH)
  drawScreenInFrame(ctx, slide, preset, screenX, screenY, screenW, screenH)

  ctx.restore()
}

function applyEffect(
  ctx: CanvasRenderingContext2D,
  effect: ScreenshotEffect,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const cx = x + w / 2
  const cy = y + h / 2

  if (effect === 'float') {
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = w * 0.12
    ctx.shadowOffsetY = h * 0.03
  } else if (effect === 'tilt') {
    // 3D perspective tilt
    ctx.translate(cx, cy)
    ctx.transform(1, 0, -0.08, 0.97, 0, 0)
    ctx.translate(-cx, -cy)
    ctx.shadowColor = 'rgba(0,0,0,0.4)'
    ctx.shadowBlur = w * 0.1
    ctx.shadowOffsetX = w * 0.04
    ctx.shadowOffsetY = h * 0.02
  } else if (effect === 'glow') {
    ctx.shadowColor = 'rgba(124,58,237,0.7)'
    ctx.shadowBlur = w * 0.18
  }
}

function drawPhoneFrame(
  ctx: CanvasRenderingContext2D,
  platform: SizePreset['platform'],
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const r = platform === 'watch' ? w * 0.2 : w * 0.1

  // Phone body gradient (metallic)
  const bodyGrad = ctx.createLinearGradient(x, y, x + w, y + h)
  bodyGrad.addColorStop(0, '#2a2a2a')
  bodyGrad.addColorStop(0.4, '#1a1a1a')
  bodyGrad.addColorStop(1, '#111111')

  ctx.beginPath()
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = bodyGrad
  ctx.fill()

  // Frame highlight
  const frameGrad = ctx.createLinearGradient(x, y, x + w, y)
  frameGrad.addColorStop(0, 'rgba(255,255,255,0.15)')
  frameGrad.addColorStop(0.5, 'rgba(255,255,255,0.05)')
  frameGrad.addColorStop(1, 'rgba(255,255,255,0.02)')
  ctx.strokeStyle = frameGrad
  ctx.lineWidth = w * 0.012
  ctx.beginPath()
  roundRect(ctx, x, y, w, h, r)
  ctx.stroke()

  // Platform-specific details
  if (platform === 'apple') {
    drawAppleDetails(ctx, x, y, w, h)
  } else if (platform === 'google') {
    drawGoogleDetails(ctx, x, y, w, h)
  } else if (platform === 'watch') {
    drawWatchDetails(ctx, x, y, w, h)
  }
}

function drawAppleDetails(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  // Dynamic Island pill at top center
  const pillW = w * 0.28
  const pillH = h * 0.015
  const pillX = x + (w - pillW) / 2
  const pillY = y + h * 0.025
  const pillR = pillH / 2
  ctx.beginPath()
  roundRect(ctx, pillX, pillY, pillW, pillH, pillR)
  ctx.fillStyle = '#000000'
  ctx.fill()

  // Side button (right)
  const btnW = w * 0.012
  const btnH = h * 0.08
  const btnX = x + w - btnW
  const btnY = y + h * 0.28
  ctx.fillStyle = '#2a2a2a'
  ctx.beginPath()
  roundRect(ctx, btnX, btnY, btnW, btnH, btnW / 2)
  ctx.fill()

  // Volume buttons (left)
  const volW = w * 0.012
  const vol1H = h * 0.055
  const volX = x - volW
  ctx.fillStyle = '#2a2a2a'
  ctx.beginPath()
  roundRect(ctx, volX, y + h * 0.22, volW, vol1H, volW / 2)
  ctx.fill()
  ctx.beginPath()
  roundRect(ctx, volX, y + h * 0.29, volW, vol1H, volW / 2)
  ctx.fill()

  // Silent switch
  ctx.beginPath()
  roundRect(ctx, volX, y + h * 0.16, volW, h * 0.035, volW / 2)
  ctx.fill()
}

function drawGoogleDetails(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  // Camera punch hole
  const holeR = w * 0.022
  const holeX = x + w / 2
  const holeY = y + h * 0.032
  ctx.beginPath()
  ctx.arc(holeX, holeY, holeR, 0, Math.PI * 2)
  ctx.fillStyle = '#000000'
  ctx.fill()

  // Side button (right)
  const btnW = w * 0.012
  ctx.fillStyle = '#2a2a2a'
  ctx.beginPath()
  roundRect(ctx, x + w - btnW, y + h * 0.32, btnW, h * 0.08, btnW / 2)
  ctx.fill()

  // Volume (right)
  ctx.beginPath()
  roundRect(ctx, x + w - btnW, y + h * 0.43, btnW, h * 0.1, btnW / 2)
  ctx.fill()
}

function drawWatchDetails(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  // Crown (right side)
  const crownW = w * 0.06
  const crownH = h * 0.15
  const crownR = crownW * 0.35
  const grad = ctx.createLinearGradient(x + w, y, x + w + crownW, y)
  grad.addColorStop(0, '#333')
  grad.addColorStop(1, '#1a1a1a')
  ctx.fillStyle = grad
  ctx.beginPath()
  roundRect(ctx, x + w - crownW * 0.4, y + h * 0.35, crownW, crownH, crownR)
  ctx.fill()

  // Side button below crown
  ctx.beginPath()
  roundRect(ctx, x + w - crownW * 0.4, y + h * 0.55, crownW, crownH * 0.45, crownR)
  ctx.fill()
}

// ─── Screen content ───────────────────────────────────────────────────────────

function drawScreenInFrame(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  preset: SizePreset,
  sx: number, sy: number, sw: number, sh: number,
): void {
  const r = sw * 0.04

  // Clip to screen area
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, sx, sy, sw, sh, r)
  ctx.clip()

  if (slide.screenshotDataUrl) {
    drawScreenshotImage(ctx, slide.screenshotDataUrl, sx, sy, sw, sh)
  } else {
    // Placeholder
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(sx, sy, sw, sh)
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    ctx.font = `${sw * 0.06}px -apple-system, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('Drop screenshot here', sx + sw / 2, sy + sh / 2)
  }

  // Hotspot pop overlay
  if (slide.hotspot) {
    drawHotspotPop(ctx, slide.hotspot, sx, sy, sw, sh)
  }

  ctx.restore()

  // Screen glass reflection (outside clip — no, we draw on top inside)
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, sx, sy, sw, sh, r)
  ctx.clip()
  const glassGrad = ctx.createLinearGradient(sx, sy, sx + sw * 0.5, sy + sh * 0.3)
  glassGrad.addColorStop(0, 'rgba(255,255,255,0.08)')
  glassGrad.addColorStop(1, 'transparent')
  ctx.fillStyle = glassGrad
  ctx.fillRect(sx, sy, sw, sh)
  ctx.restore()
}

function drawScreenshotImage(
  ctx: CanvasRenderingContext2D,
  dataUrl: string,
  x: number, y: number, w: number, h: number,
): void {
  const img = imageCache.get(dataUrl)
  if (img?.complete) {
    ctx.drawImage(img, x, y, w, h)
  } else {
    // Draw placeholder until image loads
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(x, y, w, h)
  }
}

// Simple image cache for the renderer
const imageCache = new Map<string, HTMLImageElement>()

export function preloadImage(dataUrl: string): Promise<void> {
  return new Promise(resolve => {
    if (imageCache.has(dataUrl)) { resolve(); return }
    const img = new Image()
    img.onload = () => { imageCache.set(dataUrl, img); resolve() }
    img.onerror = () => resolve()
    img.src = dataUrl
  })
}

// ─── Hotspot pop ──────────────────────────────────────────────────────────────

function drawHotspotPop(
  ctx: CanvasRenderingContext2D,
  hotspot: Hotspot,
  sx: number, sy: number, sw: number, sh: number,
): void {
  // Convert normalized hotspot to pixel coords
  const hx = sx + hotspot.x * sw
  const hy = sy + hotspot.y * sh
  const hw = hotspot.w * sw
  const hh = hotspot.h * sh

  // Shadow beneath the popped region
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.6)'
  ctx.shadowBlur = hw * 0.15
  ctx.shadowOffsetY = hh * 0.06

  // Pop: scale up slightly around the hotspot center
  const popCx = hx + hw / 2
  const popCy = hy + hh / 2
  const scale = 1.08
  ctx.translate(popCx, popCy)
  ctx.scale(scale, scale)
  ctx.translate(-popCx, -popCy)

  // Clip using evenodd to create the "lifted out" look
  ctx.beginPath()
  // Outer rect (full screen — even winding)
  ctx.rect(sx, sy, sw, sh)
  // Inner rect (popped region — odd winding)
  roundRect(ctx, hx, hy, hw, hh, hw * 0.04)
  ctx.clip('evenodd')

  // Draw a dimming overlay on everything EXCEPT the hotspot
  ctx.fillStyle = 'rgba(0,0,0,0.3)'
  ctx.fillRect(sx, sy, sw, sh)

  ctx.restore()
}

// ─── Text block ───────────────────────────────────────────────────────────────

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  preset: SizePreset,
  area: { x: number; y: number; w: number; h: number },
): void {
  const color = slide.textColor === 'white' ? '#ffffff' : '#111111'
  const subColor = slide.textColor === 'white' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'

  const headlineSz = Math.round(preset.width * 0.055)
  const subtextSz = Math.round(preset.width * 0.032)
  const lineH = headlineSz * 1.2
  const subH = subtextSz * 1.4

  const totalH = lineH + subH + headlineSz * 0.4
  const startY = area.y + (area.h - totalH) / 2

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  ctx.font = `700 ${headlineSz}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`
  wrapText(ctx, slide.headline || 'Your headline', area.x + area.w / 2, startY, area.w * 0.9, lineH)

  ctx.fillStyle = subColor
  ctx.font = `400 ${subtextSz}px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`
  wrapText(ctx, slide.subtext || '', area.x + area.w / 2, startY + lineH + headlineSz * 0.4, area.w * 0.9, subH)
  ctx.restore()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  y: number,
  maxW: number,
  lineH: number,
): void {
  if (!text) return
  const words = text.split(' ')
  let line = ''
  let curY = y

  for (const word of words) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, cx, curY)
      line = word
      curY += lineH
    } else {
      line = test
    }
  }
  if (line) ctx.fillText(line, cx, curY)
}

// ─── Feature graphic layout ───────────────────────────────────────────────────

function drawFeatureGraphicLayout(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  preset: SizePreset,
): void {
  const { width: w, height: h } = preset
  const pad = w * 0.06

  // Left: text block
  const textArea = { x: pad, y: 0, w: w * 0.45 - pad, h }
  drawTextBlock(ctx, slide, preset, textArea)

  // Right: screenshot (no frame for feature graphic)
  if (slide.screenshotDataUrl) {
    ctx.save()
    const imgX = w * 0.48
    const imgW = w * 0.48
    const imgH = h * 0.88
    const imgY = (h - imgH) / 2
    ctx.beginPath()
    roundRect(ctx, imgX, imgY, imgW, imgH, imgW * 0.04)
    ctx.clip()
    const img = imageCache.get(slide.screenshotDataUrl)
    if (img?.complete) ctx.drawImage(img, imgX, imgY, imgW, imgH)
    ctx.restore()
  }
}

// ─── Watermark ────────────────────────────────────────────────────────────────

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  textColor: Slide['textColor'],
): void {
  ctx.save()
  ctx.globalAlpha = 0.3
  ctx.fillStyle = textColor === 'white' ? '#ffffff' : '#000000'
  ctx.font = `400 ${Math.round(w * 0.018)}px -apple-system, sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText('IndieOS', w - Math.round(w * 0.03), h - Math.round(h * 0.015))
  ctx.restore()
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}
