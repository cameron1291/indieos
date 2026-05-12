import type { Slide, SizePreset, Background, ScreenshotEffect } from './types'

// ─── Image cache ──────────────────────────────────────────────────────────────

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

// ─── Main entry ───────────────────────────────────────────────────────────────

export function renderToCanvas(
  canvas: HTMLCanvasElement,
  slide: Slide,
  preset: SizePreset,
): void {
  const { width: W, height: H } = preset
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, W, H)

  drawBackground(ctx, slide.background, W, H)
  drawDecorativeGlows(ctx, slide.background, W, H)

  // Google feature graphic has its own layout
  if (preset.platform === 'google' && W > H) {
    drawFeatureGraphicLayout(ctx, slide, preset)
    drawWatermark(ctx, W, H, slide.textColor)
    return
  }

  const layout = computePhoneLayout(preset, slide.textPosition)

  if (slide.textPosition === 'top') {
    drawTextBlock(ctx, slide, preset, layout.textArea)
    drawPhone(ctx, slide, preset, layout)
  } else if (slide.textPosition === 'bottom') {
    drawPhone(ctx, slide, preset, layout)
    drawTextBlock(ctx, slide, preset, layout.textArea)
  } else {
    // middle: phone centered, text overlaid on screen
    drawPhone(ctx, slide, preset, layout)
    drawMiddleTextOverlay(ctx, slide, layout, preset)
  }

  drawWatermark(ctx, W, H, slide.textColor)
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
    const rad = ((bg.angle ?? 145) * Math.PI) / 180
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
    // Diagonal split — color 1 fills left/bottom triangle, color 2 fills right/top
    const c1 = bg.colors[0] ?? '#3b0764'
    const c2 = bg.colors[1] ?? '#7c3aed'

    // Base fill with c1
    ctx.fillStyle = c1
    ctx.fillRect(0, 0, w, h)

    // Diagonal triangle for c2 (top-right to bottom-left, offset for 2-screen feel)
    ctx.fillStyle = c2
    ctx.beginPath()
    ctx.moveTo(w * 0.38, 0)  // starts 38% from left on top edge
    ctx.lineTo(w, 0)          // top-right corner
    ctx.lineTo(w, h)          // bottom-right corner
    ctx.lineTo(w * 0.62, h)   // ends 62% from left on bottom edge
    ctx.closePath()
    ctx.fill()

    // Blend edge: a soft gradient over the diagonal seam
    const seamGrad = ctx.createLinearGradient(w * 0.33, 0, w * 0.67, h)
    seamGrad.addColorStop(0, 'rgba(0,0,0,0)')
    seamGrad.addColorStop(0.45, 'rgba(255,255,255,0.06)')
    seamGrad.addColorStop(0.55, 'rgba(0,0,0,0.06)')
    seamGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = seamGrad
    ctx.fillRect(0, 0, w, h)
  }
}

// ─── Ambient glows ────────────────────────────────────────────────────────────

function drawDecorativeGlows(
  ctx: CanvasRenderingContext2D,
  bg: Background,
  w: number,
  h: number,
): void {
  const color = bg.colors[bg.colors.length - 1] ?? '#7c3aed'
  ctx.save()
  ctx.globalAlpha = 0.16

  const g1 = ctx.createRadialGradient(w * 0.15, h * 0.2, 0, w * 0.15, h * 0.2, w * 0.5)
  g1.addColorStop(0, color)
  g1.addColorStop(1, 'transparent')
  ctx.fillStyle = g1
  ctx.fillRect(0, 0, w, h)

  const g2 = ctx.createRadialGradient(w * 0.85, h * 0.8, 0, w * 0.85, h * 0.8, w * 0.45)
  g2.addColorStop(0, color)
  g2.addColorStop(1, 'transparent')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, w, h)

  ctx.restore()
}

// ─── Layout ───────────────────────────────────────────────────────────────────

interface PhoneLayout {
  phoneX: number; phoneY: number; phoneW: number; phoneH: number
  screenX: number; screenY: number; screenW: number; screenH: number
  textArea: { x: number; y: number; w: number; h: number }
}

function computePhoneLayout(preset: SizePreset, textPosition: Slide['textPosition']): PhoneLayout {
  const { width: W, height: H, platform } = preset
  const isWatch = platform === 'watch'

  const phoneWFrac = isWatch ? 0.5 : 0.72
  const phoneW = Math.round(W * phoneWFrac)
  const phoneAspect = isWatch ? 1.22 : 2.16
  const phoneH = Math.round(phoneW * phoneAspect)

  const textH = Math.round(H * 0.2)
  const pad = Math.round(H * 0.04)

  const phoneX = Math.round((W - phoneW) / 2)
  let phoneY: number
  let textArea: PhoneLayout['textArea']

  if (textPosition === 'top') {
    phoneY = textH + pad
    textArea = { x: pad, y: pad, w: W - pad * 2, h: textH - pad }
  } else if (textPosition === 'bottom') {
    phoneY = pad
    const textY = phoneY + phoneH + pad
    textArea = { x: pad, y: textY, w: W - pad * 2, h: H - textY - pad }
  } else {
    phoneY = Math.round((H - phoneH) / 2)
    textArea = { x: pad, y: phoneY, w: W - pad * 2, h: phoneH }
  }

  const frameTop = isWatch ? phoneH * 0.06 : phoneH * 0.04
  const frameBottom = isWatch ? phoneH * 0.06 : phoneH * 0.03
  const frameSide = phoneW * 0.04

  return {
    phoneX, phoneY, phoneW, phoneH,
    screenX: phoneX + frameSide,
    screenY: phoneY + frameTop,
    screenW: phoneW - frameSide * 2,
    screenH: phoneH - frameTop - frameBottom,
    textArea,
  }
}

// ─── Phone + screen rendering ─────────────────────────────────────────────────

function drawPhone(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  preset: SizePreset,
  layout: PhoneLayout,
): void {
  const { phoneX: px, phoneY: py, phoneW: pw, phoneH: ph,
          screenX: sx, screenY: sy, screenW: sw, screenH: sh } = layout

  ctx.save()
  applyEffect(ctx, slide.screenshotEffect, px, py, pw, ph)
  drawPhoneFrame(ctx, preset.platform, px, py, pw, ph)
  drawScreenContent(ctx, slide, sx, sy, sw, sh)
  ctx.restore()
}

function applyEffect(
  ctx: CanvasRenderingContext2D,
  effect: ScreenshotEffect,
  x: number, y: number, w: number, h: number,
): void {
  if (effect === 'float') {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'
    ctx.shadowBlur = w * 0.14
    ctx.shadowOffsetY = h * 0.035
  } else if (effect === 'tilt') {
    const cx = x + w / 2, cy = y + h / 2
    ctx.translate(cx, cy)
    ctx.transform(1, 0, -0.07, 0.97, 0, 0)
    ctx.translate(-cx, -cy)
    ctx.shadowColor = 'rgba(0,0,0,0.45)'
    ctx.shadowBlur = w * 0.1
    ctx.shadowOffsetX = w * 0.035
    ctx.shadowOffsetY = h * 0.02
  } else if (effect === 'glow') {
    ctx.shadowColor = 'rgba(139,92,246,0.75)'
    ctx.shadowBlur = w * 0.2
  }
}

function drawPhoneFrame(
  ctx: CanvasRenderingContext2D,
  platform: SizePreset['platform'],
  x: number, y: number, w: number, h: number,
): void {
  const r = platform === 'watch' ? w * 0.2 : w * 0.1

  const body = ctx.createLinearGradient(x, y, x + w, y + h)
  body.addColorStop(0, '#2c2c2e')
  body.addColorStop(0.45, '#1c1c1e')
  body.addColorStop(1, '#0e0e0f')
  ctx.beginPath()
  roundRect(ctx, x, y, w, h, r)
  ctx.fillStyle = body
  ctx.fill()

  // Rim highlight
  const rim = ctx.createLinearGradient(x, y, x + w, y)
  rim.addColorStop(0, 'rgba(255,255,255,0.18)')
  rim.addColorStop(0.5, 'rgba(255,255,255,0.06)')
  rim.addColorStop(1, 'rgba(255,255,255,0.02)')
  ctx.strokeStyle = rim
  ctx.lineWidth = w * 0.013
  ctx.beginPath()
  roundRect(ctx, x, y, w, h, r)
  ctx.stroke()

  ctx.shadowColor = 'transparent'
  ctx.shadowBlur = 0
  ctx.shadowOffsetX = 0
  ctx.shadowOffsetY = 0

  if (platform === 'apple') drawAppleDetails(ctx, x, y, w, h)
  else if (platform === 'google') drawGoogleDetails(ctx, x, y, w, h)
  else drawWatchDetails(ctx, x, y, w, h)
}

function drawAppleDetails(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Dynamic Island
  const pillW = w * 0.27, pillH = h * 0.014
  ctx.beginPath()
  roundRect(ctx, x + (w - pillW) / 2, y + h * 0.025, pillW, pillH, pillH / 2)
  ctx.fillStyle = '#000'
  ctx.fill()

  // Power button (right)
  const bW = w * 0.013, bH = h * 0.08
  ctx.fillStyle = '#252525'
  ctx.beginPath()
  roundRect(ctx, x + w - bW, y + h * 0.28, bW, bH, bW / 2)
  ctx.fill()

  // Volume + silent (left)
  ctx.beginPath()
  roundRect(ctx, x - bW, y + h * 0.16, bW, h * 0.034, bW / 2)
  ctx.fill()
  ctx.beginPath()
  roundRect(ctx, x - bW, y + h * 0.22, bW, h * 0.055, bW / 2)
  ctx.fill()
  ctx.beginPath()
  roundRect(ctx, x - bW, y + h * 0.29, bW, h * 0.055, bW / 2)
  ctx.fill()
}

function drawGoogleDetails(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  // Punch-hole camera
  const r = w * 0.022
  ctx.beginPath()
  ctx.arc(x + w / 2, y + h * 0.032, r, 0, Math.PI * 2)
  ctx.fillStyle = '#000'
  ctx.fill()

  const bW = w * 0.013
  ctx.fillStyle = '#252525'
  ctx.beginPath()
  roundRect(ctx, x + w - bW, y + h * 0.32, bW, h * 0.08, bW / 2)
  ctx.fill()
  ctx.beginPath()
  roundRect(ctx, x + w - bW, y + h * 0.43, bW, h * 0.1, bW / 2)
  ctx.fill()
}

function drawWatchDetails(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const cW = w * 0.065, cH = h * 0.15, cR = cW * 0.35
  ctx.fillStyle = '#252525'
  ctx.beginPath()
  roundRect(ctx, x + w - cW * 0.4, y + h * 0.34, cW, cH, cR)
  ctx.fill()
  ctx.beginPath()
  roundRect(ctx, x + w - cW * 0.4, y + h * 0.54, cW, cH * 0.45, cR)
  ctx.fill()
}

// ─── Screen content ───────────────────────────────────────────────────────────

function drawScreenContent(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  sx: number, sy: number, sw: number, sh: number,
): void {
  const r = sw * 0.04

  ctx.save()
  ctx.beginPath()
  roundRect(ctx, sx, sy, sw, sh, r)
  ctx.clip()

  if (slide.screenshotDataUrl) {
    const img = imageCache.get(slide.screenshotDataUrl)
    if (img?.complete) {
      ctx.drawImage(img, sx, sy, sw, sh)
    } else {
      drawScreenPlaceholder(ctx, sx, sy, sw, sh)
    }
  } else {
    drawScreenPlaceholder(ctx, sx, sy, sw, sh)
  }

  // Hotspot pop BEFORE restoring clip
  if (slide.hotspot) {
    drawHotspotPop(ctx, slide, sx, sy, sw, sh)
  }

  ctx.restore()

  // Glass sheen (drawn after clip restore so it stays within screen)
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, sx, sy, sw, sh, r)
  ctx.clip()
  const sheen = ctx.createLinearGradient(sx, sy, sx + sw * 0.6, sy + sh * 0.3)
  sheen.addColorStop(0, 'rgba(255,255,255,0.07)')
  sheen.addColorStop(1, 'transparent')
  ctx.fillStyle = sheen
  ctx.fillRect(sx, sy, sw, sh)
  ctx.restore()
}

function drawScreenPlaceholder(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
): void {
  ctx.fillStyle = '#141420'
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = 'rgba(255,255,255,0.1)'
  ctx.font = `${w * 0.055}px -apple-system, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('Drop screenshot', x + w / 2, y + h / 2)
}

// ─── Hotspot pop ──────────────────────────────────────────────────────────────
// Called while clip is active (screen area only).
// 1. Dims the whole screen
// 2. Redraws the hotspot region from the source image — scaled 6% larger — with drop shadow
// 3. Adds a highlight border

function drawHotspotPop(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  sx: number, sy: number, sw: number, sh: number,
): void {
  const hotspot = slide.hotspot!
  const img = slide.screenshotDataUrl ? imageCache.get(slide.screenshotDataUrl) : null

  const hx = sx + hotspot.x * sw
  const hy = sy + hotspot.y * sh
  const hw = hotspot.w * sw
  const hh = hotspot.h * sh
  const cornerR = Math.min(hw, hh) * 0.05
  const scale = 1.06
  const popCx = hx + hw / 2
  const popCy = hy + hh / 2

  // 1. Dark dimming over the whole screen
  ctx.fillStyle = 'rgba(0,0,0,0.52)'
  ctx.fillRect(sx, sy, sw, sh)

  // 2. Render the popped region, scaled up with shadow
  ctx.save()

  // Shadow must be set BEFORE the transform so it renders relative to the final position
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = Math.min(hw, hh) * 0.18
  ctx.shadowOffsetY = Math.min(hw, hh) * 0.07

  ctx.translate(popCx, popCy)
  ctx.scale(scale, scale)
  ctx.translate(-popCx, -popCy)

  ctx.save()
  ctx.beginPath()
  roundRect(ctx, hx, hy, hw, hh, cornerR)
  ctx.clip()

  if (img?.complete) {
    // Source: the exact crop from the screenshot that maps to this hotspot area
    const srcX = hotspot.x * img.naturalWidth
    const srcY = hotspot.y * img.naturalHeight
    const srcW = hotspot.w * img.naturalWidth
    const srcH = hotspot.h * img.naturalHeight
    ctx.shadowColor = 'transparent'
    ctx.drawImage(img, srcX, srcY, srcW, srcH, hx, hy, hw, hh)
  } else {
    ctx.fillStyle = '#2a2a3e'
    ctx.fillRect(hx, hy, hw, hh)
  }
  ctx.restore()

  ctx.restore()

  // 3. Highlight border around the popped region
  ctx.save()
  ctx.translate(popCx, popCy)
  ctx.scale(scale, scale)
  ctx.translate(-popCx, -popCy)
  ctx.beginPath()
  roundRect(ctx, hx, hy, hw, hh, cornerR)
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'
  ctx.lineWidth = sw * 0.004
  ctx.stroke()
  ctx.restore()
}

// ─── Middle text overlay ──────────────────────────────────────────────────────
// Draws text centered on the phone screen with a frosted-glass pill behind it.

function drawMiddleTextOverlay(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  layout: PhoneLayout,
  preset: SizePreset,
): void {
  const { screenX: sx, screenY: sy, screenW: sw, screenH: sh } = layout
  const r = sw * 0.04

  const headlineSz = Math.round(sw * 0.1)
  const subtextSz = Math.round(sw * 0.06)
  const lineH = headlineSz * 1.25
  const subH = subtextSz * 1.4
  const innerPad = sw * 0.07
  const pillPadV = headlineSz * 0.6
  const totalContentH = lineH + (slide.subtext ? subH + headlineSz * 0.3 : 0)
  const pillH = totalContentH + pillPadV * 2

  const pillX = sx + sw * 0.06
  const pillW = sw * 0.88
  const pillY = sy + (sh - pillH) / 2
  const pillR = sw * 0.05

  // Scrim gradient on screen behind the pill (bottom-up darkness)
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, sx, sy, sw, sh, r)
  ctx.clip()
  const scrim = ctx.createLinearGradient(0, sy + sh * 0.3, 0, sy + sh)
  scrim.addColorStop(0, 'rgba(0,0,0,0)')
  scrim.addColorStop(1, 'rgba(0,0,0,0.6)')
  ctx.fillStyle = scrim
  ctx.fillRect(sx, sy, sw, sh)
  ctx.restore()

  // Frosted glass pill
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, pillX, pillY, pillW, pillH, pillR)
  ctx.fillStyle = 'rgba(10,10,20,0.62)'
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.14)'
  ctx.lineWidth = sw * 0.003
  ctx.stroke()
  ctx.restore()

  // Text inside pill
  const color = 'rgba(255,255,255,0.96)'
  const subColor = 'rgba(255,255,255,0.72)'

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  ctx.font = `700 ${headlineSz}px -apple-system, "SF Pro Display", Arial, sans-serif`
  wrapText(ctx, slide.headline || '', sx + sw / 2, pillY + pillPadV, pillW - innerPad * 2, lineH)

  if (slide.subtext) {
    ctx.fillStyle = subColor
    ctx.font = `400 ${subtextSz}px -apple-system, "SF Pro Text", Arial, sans-serif`
    wrapText(ctx, slide.subtext, sx + sw / 2, pillY + pillPadV + lineH + headlineSz * 0.3, pillW - innerPad * 2, subH)
  }
  ctx.restore()
}

// ─── Text block (top/bottom) ──────────────────────────────────────────────────

function drawTextBlock(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  preset: SizePreset,
  area: { x: number; y: number; w: number; h: number },
): void {
  if (!slide.headline && !slide.subtext) return

  const color = slide.textColor === 'white' ? '#ffffff' : '#111111'
  const subColor = slide.textColor === 'white' ? 'rgba(255,255,255,0.72)' : 'rgba(0,0,0,0.58)'

  const headlineSz = Math.round(preset.width * 0.054)
  const subtextSz = Math.round(preset.width * 0.031)
  const lineH = headlineSz * 1.22
  const subH = subtextSz * 1.4

  const totalH = lineH + (slide.subtext ? subH + headlineSz * 0.35 : 0)
  const startY = area.y + (area.h - totalH) / 2

  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillStyle = color
  ctx.font = `700 ${headlineSz}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`
  wrapText(ctx, slide.headline || '', area.x + area.w / 2, startY, area.w * 0.88, lineH)

  if (slide.subtext) {
    ctx.fillStyle = subColor
    ctx.font = `400 ${subtextSz}px -apple-system, "SF Pro Text", "Helvetica Neue", Arial, sans-serif`
    wrapText(ctx, slide.subtext, area.x + area.w / 2, startY + lineH + headlineSz * 0.35, area.w * 0.88, subH)
  }
  ctx.restore()
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number, y: number,
  maxW: number, lineH: number,
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

// ─── Feature graphic ──────────────────────────────────────────────────────────

function drawFeatureGraphicLayout(
  ctx: CanvasRenderingContext2D,
  slide: Slide,
  preset: SizePreset,
): void {
  const { width: w, height: h } = preset
  const pad = w * 0.06

  const textArea = { x: pad, y: 0, w: w * 0.44 - pad, h }
  drawTextBlock(ctx, slide, preset, textArea)

  if (slide.screenshotDataUrl) {
    const img = imageCache.get(slide.screenshotDataUrl)
    if (img?.complete) {
      const imgX = w * 0.48
      const imgW = w * 0.48
      const imgH = h * 0.88
      const imgY = (h - imgH) / 2
      ctx.save()
      ctx.beginPath()
      roundRect(ctx, imgX, imgY, imgW, imgH, imgW * 0.04)
      ctx.clip()
      ctx.drawImage(img, imgX, imgY, imgW, imgH)
      ctx.restore()
    }
  }
}

// ─── Watermark ────────────────────────────────────────────────────────────────

function drawWatermark(
  ctx: CanvasRenderingContext2D,
  w: number, h: number,
  textColor: Slide['textColor'],
): void {
  ctx.save()
  ctx.globalAlpha = 0.28
  ctx.fillStyle = textColor === 'white' ? '#ffffff' : '#000000'
  ctx.font = `400 ${Math.round(w * 0.017)}px -apple-system, sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.fillText('IndieOS', w - Math.round(w * 0.025), h - Math.round(h * 0.012))
  ctx.restore()
}

// ─── Utility ──────────────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(x, y, w, h, r)
    return
  }
  const rr = Math.min(r, w / 2, h / 2)
  ctx.moveTo(x + rr, y)
  ctx.lineTo(x + w - rr, y)
  ctx.arcTo(x + w, y, x + w, y + rr, rr)
  ctx.lineTo(x + w, y + h - rr)
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr)
  ctx.lineTo(x + rr, y + h)
  ctx.arcTo(x, y + h, x, y + h - rr, rr)
  ctx.lineTo(x, y + rr)
  ctx.arcTo(x, y, x + rr, y, rr)
  ctx.closePath()
}
