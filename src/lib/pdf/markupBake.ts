import {
  PDFDocument,
  PDFRef,
  StandardFonts,
  degrees,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import type { PageViewport } from 'pdfjs-dist'
import { getActiveDocument } from './session'
import { getRetainedDocument } from './documentSource'
import { STAMPS, type Markup, type NormBox } from './markup'
import { ESIGN_LINE_HEIGHT, esignLayout } from './esignLayout'
import { useMarkupStore } from '../../state/markupStore'
import { loadEditable } from './assemble'
import { winAnsi } from './winansi'

const ink = rgb(27 / 255, 39 / 255, 51 / 255)
const highlight = rgb(0.95, 0.82, 0.28)
const noteFill = rgb(0.97, 0.91, 0.64)
const rule = rgb(0.88, 0.55, 0.22)

function hexRgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16)
  return rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255)
}

async function viewportsFor(items: Markup[]) {
  const retained = getRetainedDocument()
  const doc = retained ? getActiveDocument(retained.id) : null
  if (!doc) throw new Error('Open a PDF first.')
  const map = new Map<number, PageViewport>()
  for (const pageNumber of new Set(items.map((item) => item.page))) {
    const page = await doc.getPage(pageNumber)
    map.set(pageNumber, page.getViewport({ scale: 1 }))
  }
  return map
}

function pdfBox(viewport: PageViewport, box: NormBox) {
  const [x1, y1] = viewport.convertToPdfPoint(box.x * viewport.width, box.y * viewport.height)
  const [x2, y2] = viewport.convertToPdfPoint(
    (box.x + box.w) * viewport.width,
    (box.y + box.h) * viewport.height,
  )
  return {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    w: Math.abs(x2 - x1),
    h: Math.abs(y2 - y1),
  }
}

function upright(viewport: PageViewport, xPx: number, yPx: number) {
  const [x, y] = viewport.convertToPdfPoint(xPx, yPx)
  const [rightX, rightY] = viewport.convertToPdfPoint(xPx + 1, yPx)
  const angle = (Math.atan2(rightY - y, rightX - x) * 180) / Math.PI
  return { x, y, angle }
}

function drawUpright(
  page: PDFPage,
  viewport: PageViewport,
  xPx: number,
  yPx: number,
  text: string,
  size: number,
  font: PDFFont,
  color: ReturnType<typeof rgb>,
) {
  const spot = upright(viewport, xPx, yPx)
  const safe = winAnsi(font, text)
  if (!safe.trim()) return
  page.drawText(safe, {
    x: spot.x,
    y: spot.y,
    size,
    font,
    color,
    rotate: degrees(spot.angle),
  })
}

function dataUrlBytes(src: string) {
  const base64 = src.slice(src.indexOf(',') + 1)
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function drawItem(
  pdf: PDFDocument,
  pages: PDFPage[],
  viewport: PageViewport,
  item: Markup,
  regular: PDFFont,
  bold: PDFFont,
) {
  const page = pages[item.page - 1]
  if (!page) return

  if (item.kind === 'highlight' || item.kind === 'underline' || item.kind === 'strike') {
    for (const rect of item.rects) {
      const box = pdfBox(viewport, rect)
      if (item.kind === 'highlight') {
        page.drawRectangle({ x: box.x, y: box.y, width: box.w, height: box.h, color: highlight, opacity: 0.45 })
      } else if (item.kind === 'underline') {
        page.drawLine({
          start: { x: box.x, y: box.y + 1 },
          end: { x: box.x + box.w, y: box.y + 1 },
          thickness: 1,
          color: rule,
        })
      } else {
        page.drawLine({
          start: { x: box.x, y: box.y + box.h / 2 },
          end: { x: box.x + box.w, y: box.y + box.h / 2 },
          thickness: 1,
          color: ink,
        })
      }
    }
    return
  }

  if (item.kind === 'cover') {
    const box = pdfBox(viewport, item)
    page.drawRectangle({ x: box.x, y: box.y, width: box.w, height: box.h, color: rgb(1, 1, 1) })
    return
  }

  if (item.kind === 'text') {
    drawUpright(
      page,
      viewport,
      item.x * viewport.width,
      item.y * viewport.height + item.size * 0.8,
      item.text,
      item.size,
      regular,
      ink,
    )
    return
  }

  if (item.kind === 'note') {
    const marker = 16
    const box = pdfBox(viewport, {
      x: item.x,
      y: item.y,
      w: marker / viewport.width,
      h: marker / viewport.height,
    })
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      color: noteFill,
      borderColor: rule,
      borderWidth: 0.8,
    })
    const words = winAnsi(regular, item.text).split(/\s+/).filter(Boolean)
    let line = ''
    let lineIndex = 0
    const size = 10
    const maxWidth = 180
    const flush = (value: string) => {
      if (!value) return
      drawUpright(
        page,
        viewport,
        item.x * viewport.width + marker + 6,
        item.y * viewport.height + lineIndex * 13 + size,
        value,
        size,
        regular,
        ink,
      )
      lineIndex += 1
    }
    for (const word of words) {
      const next = line ? `${line} ${word}` : word
      if (regular.widthOfTextAtSize(next, size) <= maxWidth) line = next
      else {
        flush(line)
        line = word
      }
    }
    flush(line)
    return
  }

  if (item.kind === 'stamp') {
    const box = pdfBox(viewport, item)
    const color = hexRgb(STAMPS.find((stamp) => stamp.label === item.label)?.color ?? '#2C6FB0')
    page.drawRectangle({
      x: box.x,
      y: box.y,
      width: box.w,
      height: box.h,
      borderColor: color,
      borderWidth: 1.6,
      color: rgb(1, 1, 1),
      opacity: 0.9,
    })
    let size = 13
    let label = item.label.toUpperCase()
    while (size > 7 && bold.widthOfTextAtSize(winAnsi(bold, label), size) > box.w - 10) size -= 1
    const textWidth = bold.widthOfTextAtSize(winAnsi(bold, label), size)
    drawUpright(
      page,
      viewport,
      (item.x + item.w / 2) * viewport.width - textWidth / 2,
      (item.y + item.h / 2) * viewport.height + size * 0.35,
      label,
      size,
      bold,
      color,
    )
    return
  }

  if (item.kind === 'picture') {
    const bytes = dataUrlBytes(item.src)
    const image = item.src.startsWith('data:image/jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
    const box = pdfBox(viewport, item)
    page.drawImage(image, { x: box.x, y: box.y, width: box.w, height: box.h })
    return
  }

  if (item.kind !== 'esign') return
  const originX = item.x * viewport.width
  const originY = item.y * viewport.height
  const layout = esignLayout(
    item.w * viewport.width,
    item.h * viewport.height,
    item.name,
    item.timestamp,
    (text) => regular.widthOfTextAtSize(winAnsi(regular, text), 1),
  )
  if (item.src) {
    const bytes = dataUrlBytes(item.src)
    const image = item.src.startsWith('data:image/jpeg') ? await pdf.embedJpg(bytes) : await pdf.embedPng(bytes)
    const area = layout.signature
    const scale = Math.min(area.w / image.width, area.h / image.height)
    const drawW = image.width * scale
    const drawH = image.height * scale
    const box = pdfBox(viewport, {
      x: (originX + area.x) / viewport.width,
      y: (originY + area.y + (area.h - drawH) / 2) / viewport.height,
      w: drawW / viewport.width,
      h: drawH / viewport.height,
    })
    page.drawImage(image, { x: box.x, y: box.y, width: box.w, height: box.h })
  }
  const { caption } = layout
  const lineStep = caption.size * ESIGN_LINE_HEIGHT
  caption.lines.forEach((line, index) => {
    const baseline = originY + caption.y + index * lineStep + (lineStep - caption.size) / 2 + caption.size * 0.78
    drawUpright(page, viewport, originX + caption.x, baseline, line, caption.size, regular, ink)
  })

  if (item.fieldId) {
    const match = /^(\d+)R(\d*)$/.exec(item.fieldId)
    if (match) {
      try {
        page.node.removeAnnot(PDFRef.of(Number(match[1]), match[2] ? Number(match[2]) : 0))
      } catch {
        // best effort; the drawn signature still renders even if the empty field widget stays
      }
    }
  }
}

export async function drawMarkups(bytes: Uint8Array, items: Markup[]) {
  const maps = await viewportsFor(items)
  const pdf = await loadEditable(bytes)
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const pages = pdf.getPages()
  for (const item of items) {
    const viewport = maps.get(item.page)
    if (!viewport) continue
    await drawItem(pdf, pages, viewport, item, regular, bold)
  }
  return pdf.save()
}

export async function workingBytes() {
  const retained = getRetainedDocument()
  if (!retained) throw new Error('Open a PDF first.')
  let bytes = retained.bytes
  const doc = getActiveDocument(retained.id)
  if (doc) {
    try {
      bytes = new Uint8Array(await doc.saveDocument())
    } catch {
      bytes = retained.bytes
    }
  }
  const items = useMarkupStore.getState().items
  if (items.length === 0) return bytes
  return drawMarkups(bytes, items)
}
