export function downloadBytes(bytes: Uint8Array, filename: string, type: string) {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  const url = URL.createObjectURL(new Blob([copy], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

export function pdfNameFrom(filename: string) {
  const base = filename.replace(/\.[^.]+$/, '').trim()
  return `${base || 'document'}.pdf`
}
