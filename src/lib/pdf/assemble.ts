import { PDFDocument, StandardFonts, degrees, rgb, type PDFFont, type PDFPage } from 'pdf-lib'
import { extensionOf, fileToRasters, isImageName, type Raster } from './images'
import { appendDocx, appendPptx, appendXlsx } from './office'
import { winAnsi } from './winansi'

const quiet = rgb(92 / 255, 110 / 255, 128 / 255)

export type PageOp = {
  id: string
  source: number | 'blank'
  rotation: 0 | 90 | 180 | 270
}

function tag(pdf: PDFDocument, title: string) {
  pdf.setTitle(title)
  pdf.setCreator('Bazure')
  pdf.setProducer('Bazure')
}

export async function loadEditable(bytes: Uint8Array) {
  try {
    return await PDFDocument.load(bytes)
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.toLowerCase().includes('encrypt')) {
      throw new Error('This PDF is protected, so Bazure can’t rebuild it.')
    }
    throw new Error('Bazure couldn’t read this PDF well enough to change it.')
  }
}

function placeImage(raster: Raster) {
  const landscape = raster.width > raster.height
  const pageW = landscape ? 792 : 612
  const pageH = landscape ? 612 : 792
  const margin = 36
  const scale = Math.min(
    (pageW - margin * 2) / raster.width,
    (pageH - margin * 2) / raster.height,
  )
  const width = raster.width * scale
  const height = raster.height * scale
  return {
    pageW,
    pageH,
    x: (pageW - width) / 2,
    y: (pageH - height) / 2,
    width,
    height,
  }
}

async function appendRaster(pdf: PDFDocument, raster: Raster) {
  const image =
    raster.kind === 'jpg' ? await pdf.embedJpg(raster.bytes) : await pdf.embedPng(raster.bytes)
  const box = placeImage(raster)
  const page = pdf.addPage([box.pageW, box.pageH])
  page.drawImage(image, {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  })
}

function isPdfFile(file: File) {
  return extensionOf(file.name) === 'pdf' || file.type === 'application/pdf'
}

async function fileBytes(file: File) {
  const raw = new Uint8Array(await file.arrayBuffer())
  const copy = new Uint8Array(raw.byteLength)
  copy.set(raw)
  return copy
}

async function loadPdfFile(file: File) {
  try {
    const source = await PDFDocument.load(await fileBytes(file), { updateMetadata: false })
    if (source.getPageCount() < 1) throw new Error(`${file.name} has no pages to merge.`)
    return source
  } catch (error) {
    if (error instanceof Error && error.message.includes('no pages')) throw error
    throw new Error(
      `${file.name} could not be added. If it has a password, open it and download a copy first.`,
    )
  }
}

async function appendPdf(pdf: PDFDocument, file: File) {
  const source = await loadPdfFile(file)
  const count = source.getPageCount()
  const before = pdf.getPageCount()
  const pages = await pdf.copyPages(source, source.getPageIndices())
  if (pages.length !== count || pdf.getPageCount() !== before) {
    throw new Error(`${file.name} could not be merged completely.`)
  }
  for (const page of pages) pdf.addPage(page)
  if (pdf.getPageCount() !== before + count) {
    throw new Error(`${file.name} could not be merged completely.`)
  }
}

async function reopen(pdf: PDFDocument, title: string) {
  const before = pdf.getPageCount()
  try {
    const next = await PDFDocument.load(await pdf.save())
    tag(next, title)
    if (next.getPageCount() === before) return next
  } catch {
    // Keep the in-memory document if a round-trip would drop pages.
  }
  return pdf
}

async function appendOne(pdf: PDFDocument, file: File) {
  const extension = extensionOf(file.name)
  if (isPdfFile(file)) {
    await appendPdf(pdf, file)
    return
  }
  if (isImageName(file.name)) {
    for (const raster of await fileToRasters(file)) await appendRaster(pdf, raster)
    return
  }
  if (extension === 'docx' || extension === 'doc') {
    await appendDocx(pdf, file)
    return
  }
  if (extension === 'xlsx' || extension === 'xls') {
    await appendXlsx(pdf, file)
    return
  }
  if (extension === 'pptx' || extension === 'ppt') {
    await appendPptx(pdf, file)
    return
  }
  throw new Error(`${file.name} isn’t a PDF, image, Word, Excel, or PowerPoint file.`)
}

export async function buildPdf(files: File[], title: string) {
  if (files.length === 0) throw new Error('Choose a file first.')

  // Start from the first PDF itself. Copying that file into a blank
  // document can drop its pages, so the file you started with never appears.
  let pdf = isPdfFile(files[0]) ? await loadPdfFile(files[0]) : await PDFDocument.create()
  tag(pdf, title)
  let index = isPdfFile(files[0]) ? 1 : 0

  let copied = false
  for (; index < files.length; index += 1) {
    const file = files[index]
    if (isPdfFile(file) && copied) pdf = await reopen(pdf, title)
    const before = pdf.getPageCount()
    await appendOne(pdf, file)
    if (pdf.getPageCount() <= before) throw new Error(`${file.name} did not add any pages.`)
    copied = true
  }

  if (pdf.getPageCount() === 0) throw new Error('Those files did not produce any pages.')
  return pdf.save()
}

export async function blankPdf() {
  const pdf = await PDFDocument.create()
  tag(pdf, 'Untitled')
  pdf.addPage([612, 792])
  return pdf.save()
}

function drawPageNumber(page: PDFPage, font: PDFFont, label: string) {
  const size = 10
  const { width, height } = page.getSize()
  const text = winAnsi(font, label)
  const textWidth = font.widthOfTextAtSize(text, size)
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  if (rotation === 90) {
    page.drawText(text, {
      x: 28,
      y: (height - textWidth) / 2,
      size,
      font,
      color: quiet,
      rotate: degrees(90),
    })
    return
  }
  if (rotation === 270) {
    page.drawText(text, {
      x: width - 28,
      y: (height + textWidth) / 2,
      size,
      font,
      color: quiet,
      rotate: degrees(270),
    })
    return
  }
  if (rotation === 180) {
    page.drawText(text, {
      x: (width + textWidth) / 2,
      y: height - 28,
      size,
      font,
      color: quiet,
      rotate: degrees(180),
    })
    return
  }
  page.drawText(text, {
    x: (width - textWidth) / 2,
    y: 28,
    size,
    font,
    color: quiet,
  })
}

export async function rebuildPages(bytes: Uint8Array, ops: PageOp[], numberPages: boolean) {
  if (ops.length === 0) throw new Error('Keep at least one page.')
  const source = await loadEditable(bytes)
  const pdf = await PDFDocument.create()
  tag(pdf, 'Bazure')
  for (const op of ops) {
    if (op.source === 'blank') {
      pdf.addPage([612, 792])
      continue
    }
    const [page] = await pdf.copyPages(source, [op.source])
    const rotation = (((page.getRotation().angle + op.rotation) % 360) + 360) % 360
    page.setRotation(degrees(rotation))
    pdf.addPage(page)
  }
  if (numberPages) {
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    pdf.getPages().forEach((page, index) => drawPageNumber(page, font, String(index + 1)))
  }
  return pdf.save()
}
