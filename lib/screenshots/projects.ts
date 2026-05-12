import type { Slide, ScreenshotProject } from './types'

export function createDefaultSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: crypto.randomUUID(),
    headline: '',
    subtext: '',
    screenshotDataUrl: null,
    background: { type: 'gradient', colors: ['#3b0764', '#7c3aed'], angle: 145 },
    textColor: 'white',
    textPosition: 'top',
    screenshotEffect: 'float',
    hotspot: null,
    ...overrides,
  }
}

export function createDefaultProject(
  appId: string,
  userId: string,
  appName: string,
  appDescription: string,
): ScreenshotProject {
  const slides = Array.from({ length: 4 }, (_, i) =>
    createDefaultSlide({ headline: `Feature ${i + 1}` }),
  )
  return {
    id: crypto.randomUUID(),
    appId,
    userId,
    name: `${appName} Screenshots`,
    appName,
    appDescription,
    slides,
    activeSlideId: slides[0].id,
    updatedAt: Date.now(),
  }
}
