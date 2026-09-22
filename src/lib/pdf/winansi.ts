import type { PDFFont } from 'pdf-lib'

const swaps: Record<string, string> = {
  '\u2018': "'",
  '\u2019': "'",
  '\u201C': '"',
  '\u201D': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2026': '...',
  '\u2022': '-',
  '\u00A0': ' ',
}

export function winAnsi(font: PDFFont, text: string) {
  let out = ''
  for (const ch of text) {
    const mapped = swaps[ch] ?? ch
    try {
      font.encodeText(mapped)
      out += mapped
    } catch {
      out += ' '
    }
  }
  return out
}
