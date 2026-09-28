/** Left share of the box used by the signature; the caption fills the rest (Acrobat-style). */
export const ESIGN_SPLIT = 0.5
export const ESIGN_LINE_HEIGHT = 1.15

export type EsignLayout = {
  pad: number
  gap: number
  signature: { x: number; y: number; w: number; h: number }
  caption: { x: number; y: number; w: number; h: number; lines: string[]; size: number }
}

/**
 * Lays out a digital-signature block in any unit (px on screen, pt in the PDF).
 * `widthAt1` returns a string's width at font size 1 in that unit.
 */
export function esignLayout(
  width: number,
  height: number,
  name: string,
  timestamp: string,
  widthAt1: (text: string) => number,
): EsignLayout {
  const pad = Math.min(height * 0.06, width * 0.02)
  const gap = Math.min(height * 0.12, width * 0.03)
  const leftW = width * ESIGN_SPLIT - pad - gap / 2
  const rightX = width * ESIGN_SPLIT + gap / 2
  const rightW = width - rightX - pad
  const innerH = height - pad * 2

  // Acrobat wraps the name onto its own line when that allows bigger text.
  const candidates = [
    [`Digitally signed by ${name}`, `Date: ${timestamp}`],
    ['Digitally signed by', name, `Date: ${timestamp}`],
  ]
  let lines = candidates[0]
  let size = 0
  for (const option of candidates) {
    const byHeight = innerH / (option.length * ESIGN_LINE_HEIGHT)
    const widest = Math.max(...option.map(widthAt1))
    const fit = widest > 0 ? Math.min(byHeight, rightW / widest) : byHeight
    if (fit > size) {
      size = fit
      lines = option
    }
  }

  const blockH = lines.length * size * ESIGN_LINE_HEIGHT
  return {
    pad,
    gap,
    signature: { x: pad, y: pad, w: Math.max(0, leftW), h: Math.max(0, innerH) },
    caption: { x: rightX, y: (height - blockH) / 2, w: Math.max(0, rightW), h: blockH, lines, size },
  }
}

let measureContext: CanvasRenderingContext2D | null = null

/** Helvetica/Arial width at size 1, matching the PDF's standard Helvetica closely. */
export function screenWidthAt1(text: string) {
  measureContext ??= document.createElement('canvas').getContext('2d')
  if (!measureContext) return text.length * 0.5
  measureContext.font = '100px Helvetica, Arial, sans-serif'
  return measureContext.measureText(text).width / 100
}
