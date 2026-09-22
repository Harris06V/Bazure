import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib'
import { strFromU8, unzipSync } from 'fflate'
import mammoth from 'mammoth'
import { extensionOf } from './images'
import { winAnsi } from './winansi'

const ink = rgb(27 / 255, 39 / 255, 51 / 255)

type TextBlock = {
  text: string
  size: number
  bold: boolean
  gap: number
}

type PageBox = {
  width: number
  height: number
}

function decodeXml(value: string) {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
}

function wrap(font: PDFFont, text: string, size: number, maxWidth: number) {
  const safe = winAnsi(font, text).replace(/\s+/g, ' ').trim()
  if (!safe) return []
  const lines: string[] = []
  let line = ''

  const pushWord = (word: string) => {
    if (font.widthOfTextAtSize(word, size) <= maxWidth) {
      const next = line ? `${line} ${word}` : word
      if (font.widthOfTextAtSize(next, size) <= maxWidth) line = next
      else {
        if (line) lines.push(line)
        line = word
      }
      return
    }
    let chunk = ''
    for (const ch of word) {
      const next = chunk + ch
      if (font.widthOfTextAtSize(next, size) <= maxWidth) chunk = next
      else {
        if (chunk) lines.push(chunk)
        chunk = ch
      }
    }
    if (line) lines.push(line)
    line = chunk
  }

  for (const word of safe.split(' ')) pushWord(word)
  if (line) lines.push(line)
  return lines
}

async function fonts(pdf: PDFDocument) {
  return {
    regular: await pdf.embedFont(StandardFonts.Helvetica),
    bold: await pdf.embedFont(StandardFonts.HelveticaBold),
  }
}

export async function appendBlocks(pdf: PDFDocument, blocks: TextBlock[], box: PageBox) {
  const face = await fonts(pdf)
  const margin = 54
  const maxWidth = box.width - margin * 2
  let page = pdf.addPage([box.width, box.height])
  let y = box.height - margin

  const nextPage = () => {
    page = pdf.addPage([box.width, box.height])
    y = box.height - margin
  }

  for (const block of blocks) {
    const font = block.bold ? face.bold : face.regular
    const lines = wrap(font, block.text, block.size, maxWidth)
    const lineHeight = block.size * 1.35
    for (const line of lines) {
      if (y - lineHeight < margin) nextPage()
      page.drawText(line, {
        x: margin,
        y: y - block.size,
        size: block.size,
        font,
        color: ink,
      })
      y -= lineHeight
    }
    y -= block.gap
  }
}

function htmlBlocks(html: string): TextBlock[] {
  const document = new DOMParser().parseFromString(html, 'text/html')
  const blocks: TextBlock[] = []
  for (const node of document.body.querySelectorAll('h1, h2, h3, p, li')) {
    if (node.tagName === 'P' && node.closest('li, td, th')) continue
    const text = node.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    if (!text) continue
    if (node.tagName === 'H1') blocks.push({ text, size: 20, bold: true, gap: 10 })
    else if (node.tagName === 'H2') blocks.push({ text, size: 16, bold: true, gap: 8 })
    else if (node.tagName === 'H3') blocks.push({ text, size: 13, bold: true, gap: 6 })
    else if (node.tagName === 'LI') blocks.push({ text: `- ${text}`, size: 12, bold: false, gap: 3 })
    else blocks.push({ text, size: 12, bold: false, gap: 8 })
  }
  return blocks
}

export async function appendDocx(pdf: PDFDocument, file: File) {
  if (extensionOf(file.name) === 'doc') {
    throw new Error('Save this Word file as .docx, then create the PDF again.')
  }
  const arrayBuffer = await file.arrayBuffer()
  const html = await mammoth.convertToHtml({ arrayBuffer }, { ignoreEmptyParagraphs: true })
  let blocks = htmlBlocks(html.value)
  if (blocks.length === 0) {
    const raw = await mammoth.extractRawText({ arrayBuffer })
    blocks = raw.value
      .split(/\n+/)
      .map((text) => text.trim())
      .filter(Boolean)
      .map((text) => ({ text, size: 12, bold: false, gap: 8 }))
  }
  if (blocks.length === 0) throw new Error('This Word file has no text to place on a page.')
  await appendBlocks(pdf, blocks, { width: 612, height: 792 })
}

function columnIndex(ref: string) {
  const letters = /^[A-Z]+/i.exec(ref)?.[0].toUpperCase() ?? 'A'
  let index = 0
  for (const ch of letters) index = index * 26 + (ch.charCodeAt(0) - 64)
  return index - 1
}

function sharedStrings(xml: string) {
  const values: string[] = []
  for (const item of xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)) {
    const text = [...item[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
      .map((match) => decodeXml(match[1]))
      .join('')
    values.push(text)
  }
  return values
}

function sheetGrid(xml: string, strings: string[]) {
  const cells: { row: number; column: number; value: string }[] = []
  for (const match of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = match[1]
    const body = match[2] ?? ''
    const ref = /r="([^"]+)"/.exec(attrs)?.[1]
    if (!ref) continue
    const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? 'n'
    let value = ''
    if (type === 'inlineStr') {
      value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((part) => decodeXml(part[1])).join('')
    } else if (type === 's') {
      const index = Number(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '')
      value = strings[index] ?? ''
    } else if (type === 'b') {
      value = /<v>\s*1/.test(body) ? 'TRUE' : 'FALSE'
    } else {
      value = decodeXml(/<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? '')
    }
    value = value.replace(/\s+/g, ' ').trim()
    if (!value) continue
    const row = Number(/[0-9]+$/.exec(ref)?.[0] ?? '1') - 1
    cells.push({ row, column: columnIndex(ref), value })
  }
  if (cells.length === 0) return []
  const rowCount = Math.max(...cells.map((cell) => cell.row)) + 1
  const columnCount = Math.min(16, Math.max(...cells.map((cell) => cell.column)) + 1)
  const grid = Array.from({ length: rowCount }, () => Array.from({ length: columnCount }, () => ''))
  for (const cell of cells) {
    if (cell.column < columnCount) grid[cell.row][cell.column] = cell.value
  }
  return grid.filter((row) => row.some((value) => value))
}

function workbookSheets(files: Record<string, Uint8Array>) {
  const workbook = files['xl/workbook.xml']
  const rels = files['xl/_rels/workbook.xml.rels']
  if (!workbook || !rels) throw new Error('This spreadsheet is missing its worksheets.')
  const workbookXml = strFromU8(workbook)
  const relsXml = strFromU8(rels)
  const targets = new Map<string, string>()
  for (const match of relsXml.matchAll(/Id="([^"]+)"[^>]*Target="([^"]+)"/g)) {
    const target = match[2].replace(/^\//, '')
    targets.set(match[1], target.startsWith('xl/') ? target : `xl/${target.replace(/^\.\.\//, '')}`)
  }
  const sheets: { name: string; path: string }[] = []
  for (const match of workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = /name="([^"]+)"/.exec(match[1])?.[1]
    const id = /r:id="([^"]+)"/.exec(match[1])?.[1]
    const path = id ? targets.get(id) : undefined
    if (name && path) sheets.push({ name: decodeXml(name), path })
  }
  return sheets
}

function fitCell(font: PDFFont, text: string, size: number, width: number) {
  const safe = winAnsi(font, text)
  if (font.widthOfTextAtSize(safe, size) <= width) return safe
  let out = safe
  while (out.length > 1 && font.widthOfTextAtSize(`${out}...`, size) > width) out = out.slice(0, -1)
  return `${out}...`
}

async function appendTable(pdf: PDFDocument, title: string, grid: string[][]) {
  const face = await fonts(pdf)
  const pageW = 792
  const pageH = 612
  const margin = 36
  const columns = Math.max(...grid.map((row) => row.length))
  const fontSize = columns > 12 ? 7 : columns > 8 ? 8 : 9
  const colW = (pageW - margin * 2) / columns
  const rowH = fontSize + 10
  let page: PDFPage | null = null
  let y = 0

  const startPage = (repeatHeader: boolean) => {
    page = pdf.addPage([pageW, pageH])
    y = pageH - margin
    page.drawText(winAnsi(face.bold, title), {
      x: margin,
      y: y - 14,
      size: 14,
      font: face.bold,
      color: ink,
    })
    y -= 28
    if (repeatHeader && grid[0]) drawRow(grid[0], true)
  }

  const drawRow = (row: string[], header: boolean) => {
    const current = page
    if (!current) return
    if (y - rowH < margin) startPage(true)
    const sheet = page
    if (!sheet) return
    const font = header ? face.bold : face.regular
    for (let column = 0; column < columns; column += 1) {
      const text = fitCell(font, row[column] ?? '', fontSize, colW - 6)
      if (!text) continue
      sheet.drawText(text, {
        x: margin + column * colW + 2,
        y: y - fontSize - 2,
        size: fontSize,
        font,
        color: ink,
      })
    }
    sheet.drawLine({
      start: { x: margin, y: y - rowH + 3 },
      end: { x: pageW - margin, y: y - rowH + 3 },
      thickness: 0.4,
      color: rgb(0.78, 0.86, 0.91),
    })
    y -= rowH
  }

  startPage(false)
  grid.forEach((row, index) => drawRow(row, index === 0))
}

export async function appendXlsx(pdf: PDFDocument, file: File) {
  if (extensionOf(file.name) === 'xls') {
    throw new Error('Save this spreadsheet as .xlsx, then create the PDF again.')
  }
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error('Save this spreadsheet as .xlsx, then create the PDF again.')
  }
  const strings = files['xl/sharedStrings.xml'] ? sharedStrings(strFromU8(files['xl/sharedStrings.xml'])) : []
  const sheets = workbookSheets(files)
  if (sheets.length === 0) throw new Error('This spreadsheet has no worksheets.')
  let wrote = false
  for (const sheet of sheets) {
    const xml = files[sheet.path]
    if (!xml) continue
    const grid = sheetGrid(strFromU8(xml), strings)
    if (grid.length === 0) continue
    await appendTable(pdf, sheet.name, grid)
    wrote = true
  }
  if (!wrote) throw new Error('This spreadsheet has no cell values to place on a page.')
}

function slideText(xml: string) {
  return [...xml.matchAll(/<a:t\b[^>]*>([\s\S]*?)<\/a:t>/g)]
    .map((match) => decodeXml(match[1]).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

export async function appendPptx(pdf: PDFDocument, file: File) {
  if (extensionOf(file.name) === 'ppt') {
    throw new Error('Save this presentation as .pptx, then create the PDF again.')
  }
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(new Uint8Array(await file.arrayBuffer()))
  } catch {
    throw new Error('Save this presentation as .pptx, then create the PDF again.')
  }
  const slides = Object.keys(files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => Number(/\d+/.exec(a)?.[0]) - Number(/\d+/.exec(b)?.[0]))
  if (slides.length === 0) throw new Error('This presentation has no slides.')
  for (const path of slides) {
    const fileBytes = files[path]
    if (!fileBytes) continue
    const lines = slideText(strFromU8(fileBytes))
    const blocks: TextBlock[] =
      lines.length === 0
        ? [{ text: ' ', size: 14, bold: false, gap: 0 }]
        : lines.map((text, index) =>
            index === 0
              ? { text, size: 26, bold: true, gap: 16 }
              : { text: `- ${text}`, size: 16, bold: false, gap: 8 },
          )
    await appendBlocks(pdf, blocks, { width: 792, height: 612 })
  }
}
