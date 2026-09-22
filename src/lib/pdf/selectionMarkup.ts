import { markupId, type Markup } from './markup'
import { useMarkupStore } from '../../state/markupStore'

export function markSelection(kind: 'highlight' | 'underline' | 'strike') {
  const selection = document.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return false

  const sheets = [...document.querySelectorAll<HTMLElement>('.page-sheet')]
  const grouped = new Map<number, Markup & { kind: typeof kind }>()

  for (const rect of selection.getRangeAt(0).getClientRects()) {
    if (rect.width < 2 || rect.height < 2) continue
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const sheet = sheets.find((element) => {
      const box = element.getBoundingClientRect()
      return centerX >= box.left && centerX <= box.right && centerY >= box.top && centerY <= box.bottom
    })
    if (!sheet) continue
    const page = Number(sheet.dataset.page)
    if (!Number.isFinite(page)) continue
    const box = sheet.getBoundingClientRect()
    const markup = grouped.get(page) ?? {
      id: markupId(),
      kind,
      page,
      rects: [],
    }
    markup.rects.push({
      x: (rect.left - box.left) / box.width,
      y: (rect.top - box.top) / box.height,
      w: rect.width / box.width,
      h: rect.height / box.height,
    })
    grouped.set(page, markup)
  }

  const markups = [...grouped.values()]
  if (markups.length === 0) return false
  useMarkupStore.getState().addMany(markups)
  selection.removeAllRanges()
  return true
}
