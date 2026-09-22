import { PixelsPerInch } from 'pdfjs-dist'
import type { PageSize, ZoomMode } from './pdf/types'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
export const ZOOM_STEP = 1.15

/** 100% is physical size: one PDF point maps to 96/72 CSS pixels. */
export const CSS_UNITS = PixelsPerInch.PDF_TO_CSS_UNITS

export const DESK_PAD_X = 48
export const DESK_PAD_Y = 56

export function clampZoom(value: number) {
  if (!Number.isFinite(value)) return 1
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value))
}

export function resolveZoom(options: {
  mode: ZoomMode
  customZoom: number
  page: PageSize
  widest: number
  viewport: { width: number; height: number }
}) {
  const { mode, customZoom, page, widest, viewport } = options
  if (mode === 'custom') return clampZoom(customZoom)

  const availableWidth = Math.max(1, viewport.width - DESK_PAD_X)
  const availableHeight = Math.max(1, viewport.height - DESK_PAD_Y)
  const pageWidth = page.width * CSS_UNITS
  const pageHeight = page.height * CSS_UNITS
  const widthBasis = Math.max(pageWidth, widest * CSS_UNITS)

  if (mode === 'fit-width') return clampZoom(availableWidth / widthBasis)

  return clampZoom(Math.min(availableWidth / pageWidth, availableHeight / pageHeight))
}

/** CSS pixel box snapped to the device pixel grid so the bitmap is not resampled. */
export function snapPageBox(page: PageSize, scale: number, pixelRatio = 1) {
  const ratio = pixelRatio > 0 ? pixelRatio : 1
  const width = Math.max(1, Math.round(page.width * CSS_UNITS * scale * ratio) / ratio)
  const height = Math.max(1, Math.round(page.height * CSS_UNITS * scale * ratio) / ratio)
  return { width, height }
}
