import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

const THRESHOLD_PX = 5

type Session = {
  id: string
  pointerId: number
  startX: number
  startY: number
  started: boolean
}

type Axis = 'x' | 'grid'

/** Insert position for a point, assuming children are laid out in reading order (row, grid, or wrap). */
function insertIndexAt(container: HTMLElement, x: number, y: number, axis: Axis) {
  const nodes = [...container.querySelectorAll<HTMLElement>('[data-reorder-id]')]
  for (let index = 0; index < nodes.length; index += 1) {
    const rect = nodes[index].getBoundingClientRect()
    const beforeCenter = x < rect.left + rect.width / 2
    if (axis === 'x') {
      if (beforeCenter) return index
      continue
    }
    if (y < rect.top) return index
    if (y <= rect.bottom && beforeCenter) return index
  }
  return nodes.length
}

/**
 * Pointer-driven drag to reorder. Works with mouse, pen, and touch; a plain
 * click (no movement past the threshold) still reaches the item's onClick.
 */
export function useDragReorder<T extends { id: string }>(
  items: T[],
  onReorder: (next: T[]) => void,
  axis: Axis = 'grid',
) {
  const containerRef = useRef<HTMLElement | null>(null)
  const session = useRef<Session | null>(null)
  const suppressClick = useRef(false)
  const latest = useRef({ items, onReorder, axis })
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [insertAt, setInsertAt] = useState<number | null>(null)

  useEffect(() => {
    latest.current = { items, onReorder, axis }
  })

  useEffect(() => {
    function onMove(event: PointerEvent) {
      const current = session.current
      const container = containerRef.current
      if (!current || !container || event.pointerId !== current.pointerId) return
      if (!current.started) {
        if (Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < THRESHOLD_PX) return
        current.started = true
        setDraggingId(current.id)
      }
      event.preventDefault()
      setInsertAt(insertIndexAt(container, event.clientX, event.clientY, latest.current.axis))
    }

    function finish(event: PointerEvent, commit: boolean) {
      const current = session.current
      const container = containerRef.current
      if (!current || event.pointerId !== current.pointerId) return
      session.current = null
      if (current.started) {
        suppressClick.current = true
        // The click that follows pointerup (if any) fires in the same task.
        window.setTimeout(() => {
          suppressClick.current = false
        }, 0)
        if (commit && container) {
          const { items: list, onReorder: apply, axis: layout } = latest.current
          const from = list.findIndex((item) => item.id === current.id)
          let to = insertIndexAt(container, event.clientX, event.clientY, layout)
          if (from >= 0) {
            if (to > from) to -= 1
            if (to !== from) {
              const next = list.slice()
              const [moved] = next.splice(from, 1)
              next.splice(to, 0, moved)
              apply(next)
            }
          }
        }
      }
      setDraggingId(null)
      setInsertAt(null)
    }

    const onUp = (event: PointerEvent) => finish(event, true)
    const onCancel = (event: PointerEvent) => finish(event, false)
    window.addEventListener('pointermove', onMove, { passive: false })
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
  }, [])

  function itemProps(id: string) {
    return {
      'data-reorder-id': id,
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (event.button !== 0 || (event.target as Element).closest('[data-no-drag]')) return
        session.current = { id, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, started: false }
      },
      onDragStart: (event: { preventDefault: () => void }) => event.preventDefault(),
    }
  }

  const containerProps = {
    ref: (node: HTMLElement | null) => {
      containerRef.current = node
    },
    onClickCapture: (event: { stopPropagation: () => void; preventDefault: () => void }) => {
      if (!suppressClick.current) return
      suppressClick.current = false
      event.stopPropagation()
      event.preventDefault()
    },
  }

  /** Where the drop marker sits: before item `index`, or after the last item. */
  function markerFor(index: number): 'before' | 'after' | null {
    if (insertAt === null || draggingId === null) return null
    if (insertAt === index) return 'before'
    if (index === items.length - 1 && insertAt === items.length) return 'after'
    return null
  }

  return { containerProps, itemProps, draggingId, markerFor }
}
