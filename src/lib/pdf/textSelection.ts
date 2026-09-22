import { normalizeUnicode } from 'pdfjs-dist'

/**
 * While a drag is in progress, link boxes let the pointer through so the
 * selection can cross them. The line-marker block pdf.js uses for that drag
 * is not added here.
 */
export function bindTextSelection(layer: HTMLElement) {
  const arm = () => layer.classList.add('selecting')
  const disarm = () => layer.classList.remove('selecting')
  const onCopy = (event: ClipboardEvent) => {
    const selection = document.getSelection()
    if (!selection || selection.isCollapsed) return
    const text = String(normalizeUnicode(selection.toString())).replaceAll('\u0000', '')
    event.clipboardData?.setData('text/plain', text)
    event.preventDefault()
  }

  layer.addEventListener('mousedown', arm)
  layer.addEventListener('copy', onCopy)
  document.addEventListener('pointerup', disarm)
  window.addEventListener('blur', disarm)

  return () => {
    layer.removeEventListener('mousedown', arm)
    layer.removeEventListener('copy', onCopy)
    document.removeEventListener('pointerup', disarm)
    window.removeEventListener('blur', disarm)
  }
}
