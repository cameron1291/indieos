export type BackgroundType = 'solid' | 'gradient' | 'split'

export interface Background {
  type: BackgroundType
  colors: string[]
  angle: number
}

export type TextColor = 'white' | 'dark'
export type TextPosition = 'top' | 'middle' | 'bottom'
export type ScreenshotEffect = 'none' | 'float' | 'tilt' | 'glow'

export interface Hotspot {
  x: number
  y: number
  w: number
  h: number
}

export interface Slide {
  id: string
  headline: string
  subtext: string
  screenshotDataUrl: string | null
  background: Background
  textColor: TextColor
  textPosition: TextPosition
  screenshotEffect: ScreenshotEffect
  hotspot: Hotspot | null
}

export interface ScreenshotProject {
  id: string
  appId: string
  userId: string
  name: string
  appName: string
  appDescription: string
  slides: Slide[]
  activeSlideId: string
  updatedAt: number
}

export interface SizePreset {
  label: string
  width: number
  height: number
  platform: 'apple' | 'google' | 'watch'
}

export type Platform = 'apple' | 'google' | 'watch'
