import { AnnotationMode, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import { zipSync } from 'fflate'
import { useMarkupStore } from '../../state/markupStore'
import { getRetainedDocument } from './documentSource'
import { workingBytes } from './markupBake'
import { getActiveDocument } from './session'
import { pdfAsset } from './setup'

async function canvasBlob(canvas: HTMLCanvasElement, type: 'image/png' | 'image/jpeg', quality?: number) {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Could not export this page.'))),
      type,
      quality,
    )
  })
  return new Uint8Array(await blob.arrayBuffer())
}

async function requireDocument() {
  const retained = getRetainedDocument()
  const doc = retained ? getActiveDocument(retained.id) : null
  if (!doc) throw new Error('Open a PDF first.')
  return doc
}

async function withDocument<T>(work: (doc: PDFDocumentProxy) => Promise<T>) {
  if (useMarkupStore.getState().items.length === 0) return work(await requireDocument())
  const bytes = await workingBytes()
  const task = getDocument({
    data: bytes.slice(),
    cMapUrl: pdfAsset('cmaps/'),
    cMapPacked: true,
    standardFontDataUrl: pdfAsset('standard_fonts/'),
    wasmUrl: pdfAsset('wasm/'),
    iccUrl: pdfAsset('iccs/'),
    enableXfa: true,
  })
  try {
    return await work(await task.promise)
  } finally {
    await task.destroy()
  }
}

async function renderPage(
  doc: PDFDocumentProxy,
  pageNumber: number,
  maxEdge: number,
  type: 'image/png' | 'image/jpeg',
  quality?: number,
) {
  const page = await doc.getPage(pageNumber)
  const base = page.getViewport({ scale: 1 })
  const scale = Math.min(2.5, maxEdge / Math.max(base.width, base.height))
  const viewport = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(viewport.width))
  canvas.height = Math.max(1, Math.round(viewport.height))
  await page.render({
    canvas,
    viewport,
    annotationMode: AnnotationMode.ENABLE_STORAGE,
  }).promise
  return {
    bytes: await canvasBlob(canvas, type, quality),
    width: base.width,
    height: base.height,
  }
}

export async function exportPageImage(pageNumber: number, type: 'png' | 'jpeg') {
  return withDocument(async (doc) => {
  const rendered = await renderPage(
    doc,
    pageNumber,
    2200,
    type === 'png' ? 'image/png' : 'image/jpeg',
    type === 'jpeg' ? 0.9 : undefined,
  )
  return rendered.bytes
  })
}

export async function exportAllImages(type: 'png' | 'jpeg') {
  return withDocument(async (doc) => {
  const files: Record<string, Uint8Array> = {}
  const extension = type === 'png' ? 'png' : 'jpg'
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const rendered = await renderPage(
      doc,
      pageNumber,
      1600,
      type === 'png' ? 'image/png' : 'image/jpeg',
      type === 'jpeg' ? 0.85 : undefined,
    )
    files[`page-${pageNumber}.${extension}`] = rendered.bytes
  }
  return zipSync(files)
  })
}

export async function exportPlainText() {
  return withDocument(async (doc) => {
  const pages: string[] = []
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/[ ]{2,}/g, ' ')
      .trim()
    pages.push(text)
  }
  return pages.join('\n\n')
  })
}

export async function rasterizeDocument(quality: number) {
  return withDocument(async (doc) => {
  const { PDFDocument } = await import('pdf-lib')
  const pdf = await PDFDocument.create()
  pdf.setCreator('Bazure')
  pdf.setProducer('Bazure')
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const rendered = await renderPage(doc, pageNumber, 1400, 'image/jpeg', quality)
    const image = await pdf.embedJpg(rendered.bytes)
    const page = pdf.addPage([rendered.width, rendered.height])
    page.drawImage(image, { x: 0, y: 0, width: rendered.width, height: rendered.height })
  }
  return pdf.save()
  })
}
