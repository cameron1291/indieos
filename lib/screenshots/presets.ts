import type { SizePreset, Background } from './types'

export const SIZE_PRESETS: SizePreset[] = [
  { label: 'iPhone 6.9"',    width: 1320, height: 2868, platform: 'apple' },
  { label: 'iPhone 6.7"',    width: 1290, height: 2796, platform: 'apple' },
  { label: 'iPhone 6.5"',    width: 1242, height: 2688, platform: 'apple' },
  { label: 'iPhone 6.1"',    width: 1179, height: 2556, platform: 'apple' },
  { label: 'iPhone 5.5"',    width: 1242, height: 2208, platform: 'apple' },
  { label: 'iPad Pro 13"',   width: 2064, height: 2752, platform: 'apple' },
  { label: 'Google Phone',   width: 1080, height: 1920, platform: 'google' },
  { label: 'Google Tablet',  width: 1600, height: 2560, platform: 'google' },
  { label: 'Feature Graphic',width: 1024, height: 500,  platform: 'google' },
  { label: 'Watch 49mm',     width: 410,  height: 502,  platform: 'watch' },
  { label: 'Watch 45mm',     width: 396,  height: 484,  platform: 'watch' },
  { label: 'Watch 44mm',     width: 368,  height: 448,  platform: 'watch' },
  { label: 'Watch 40mm',     width: 324,  height: 394,  platform: 'watch' },
]

export const COLOR_PRESETS: Background[] = [
  { type: 'gradient', colors: ['#3b0764', '#7c3aed'], angle: 145 },
  { type: 'gradient', colors: ['#0c1445', '#1d4ed8'], angle: 145 },
  { type: 'gradient', colors: ['#431407', '#ea580c'], angle: 145 },
  { type: 'gradient', colors: ['#052e16', '#16a34a'], angle: 145 },
  { type: 'gradient', colors: ['#0f172a', '#334155'], angle: 145 },
  { type: 'gradient', colors: ['#831843', '#db2777'], angle: 145 },
  { type: 'solid',    colors: ['#f8f8ff'],             angle: 0   },
  { type: 'solid',    colors: ['#0f0f1a'],             angle: 0   },
]

export const SERIES_PALETTES: Background[][] = [
  [
    { type: 'gradient', colors: ['#3b0764', '#7c3aed'], angle: 145 },
    { type: 'gradient', colors: ['#4c0091', '#9333ea'], angle: 160 },
    { type: 'gradient', colors: ['#2e1065', '#6d28d9'], angle: 130 },
    { type: 'split',    colors: ['#3b0764', '#7c3aed'], angle: 0   },
    { type: 'gradient', colors: ['#1e0035', '#5b21b6'], angle: 145 },
  ],
  [
    { type: 'gradient', colors: ['#0c1445', '#1d4ed8'], angle: 145 },
    { type: 'gradient', colors: ['#0f1f5c', '#2563eb'], angle: 160 },
    { type: 'gradient', colors: ['#0a1128', '#1e40af'], angle: 130 },
    { type: 'split',    colors: ['#0c1445', '#1d4ed8'], angle: 0   },
    { type: 'gradient', colors: ['#060c24', '#1d4ed8'], angle: 145 },
  ],
  [
    { type: 'gradient', colors: ['#431407', '#ea580c'], angle: 145 },
    { type: 'gradient', colors: ['#7c2d12', '#f97316'], angle: 160 },
    { type: 'gradient', colors: ['#1c0a03', '#c2410c'], angle: 130 },
    { type: 'split',    colors: ['#431407', '#ea580c'], angle: 0   },
    { type: 'gradient', colors: ['#2c0a02', '#ea580c'], angle: 145 },
  ],
  [
    { type: 'gradient', colors: ['#052e16', '#16a34a'], angle: 145 },
    { type: 'gradient', colors: ['#14532d', '#22c55e'], angle: 160 },
    { type: 'gradient', colors: ['#030f07', '#15803d'], angle: 130 },
    { type: 'split',    colors: ['#052e16', '#16a34a'], angle: 0   },
    { type: 'gradient', colors: ['#01100a', '#16a34a'], angle: 145 },
  ],
]
